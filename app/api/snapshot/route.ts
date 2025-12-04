import { NextRequest, NextResponse } from "next/server";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";
import { getSnapshot, getOwnership, saveSnapshot, Network } from "@/app/lib/db";

// ERC721 Transfer(address from, address to, uint256 tokenId)
const TRANSFER_EVENT_SIGNATURE =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const HYPERSYNC_URLS: Record<Network, string> = {
  testnet: "https://monad-testnet.hypersync.xyz",
  mainnet: "https://monad.hypersync.xyz",
};

function parseAddress(topic: string): string {
  // Topics are 32 bytes, addresses are 20 bytes (40 hex chars)
  return "0x" + topic.slice(-40).toLowerCase();
}

function parseTokenId(topic: string): string {
  return BigInt(topic).toString();
}

// Create a leaf for the merkle tree: keccak256(owner + tokenId)
function createLeaf(owner: string, tokenId: string): Buffer {
  // Pack owner (address) and tokenId (uint256) similar to abi.encodePacked
  const ownerBytes = Buffer.from(owner.slice(2).padStart(40, "0"), "hex");
  const tokenIdHex = BigInt(tokenId).toString(16).padStart(64, "0");
  const tokenIdBytes = Buffer.from(tokenIdHex, "hex");
  const packed = Buffer.concat([ownerBytes, tokenIdBytes]);
  return keccak256(packed);
}

interface HypersyncLog {
  topic0: string;
  topic1: string;
  topic2: string;
  topic3: string;
}

interface HypersyncDataBlock {
  logs: HypersyncLog[];
}

interface HypersyncResponse {
  data: HypersyncDataBlock[];
  next_block?: number;
}

async function queryHypersync(
  contractAddress: string,
  fromBlock: number,
  network: Network
): Promise<HypersyncResponse> {
  const query = {
    from_block: fromBlock,
    logs: [
      {
        address: [contractAddress],
        topics: [[TRANSFER_EVENT_SIGNATURE]],
      },
    ],
    field_selection: {
      log: ["topic0", "topic1", "topic2", "topic3"],
    },
  };

  const response = await fetch(`${HYPERSYNC_URLS[network]}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.HYPERSYNC_BEARER_TOKEN}`,
    },
    body: JSON.stringify(query),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HyperSync error: ${response.status} - ${text}`);
  }

  return response.json();
}

async function getLatestBlock(network: Network): Promise<number> {
  const response = await fetch(`${HYPERSYNC_URLS[network]}/height`, {
    headers: {
      Authorization: `Bearer ${process.env.HYPERSYNC_BEARER_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to get latest block");
  }

  const data = await response.json();
  return data.height;
}

async function fetchFromHypersync(contractAddress: string, network: Network) {
  const latestBlock = await getLatestBlock(network);

  // Map to track current ownership: tokenId -> owner
  const ownership = new Map<string, string>();

  let fromBlock = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await queryHypersync(contractAddress, fromBlock, network);

    // Process all data blocks
    if (response.data && response.data.length > 0) {
      for (const block of response.data) {
        if (block.logs) {
          for (const log of block.logs) {
            if (log.topic2 && log.topic3) {
              const to = parseAddress(log.topic2);
              const tokenId = parseTokenId(log.topic3);

              // Update ownership - transfers always update the owner
              ownership.set(tokenId, to);
            }
          }
        }
      }
    }

    // Check if there's more data
    if (response.next_block && response.next_block > fromBlock) {
      fromBlock = response.next_block;
    } else {
      hasMore = false;
    }

    // Safety: if we got no data blocks, stop
    if (!response.data?.length && !response.next_block) {
      hasMore = false;
    }
  }

  // Filter out burned tokens (sent to zero address)
  const zeroAddress = "0x0000000000000000000000000000000000000000";
  const activeOwnership: { tokenId: string; owner: string }[] = [];
  const uniqueOwners = new Set<string>();

  // Sort by tokenId numerically
  const sortedTokenIds = Array.from(ownership.keys()).sort(
    (a, b) => Number(BigInt(a) - BigInt(b))
  );

  for (const tokenId of sortedTokenIds) {
    const owner = ownership.get(tokenId)!;
    if (owner !== zeroAddress) {
      activeOwnership.push({ tokenId, owner });
      uniqueOwners.add(owner);
    }
  }

  // Generate merkle tree
  const leaves = activeOwnership.map(({ owner, tokenId }) =>
    createLeaf(owner, tokenId)
  );
  const merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const merkleRoot = merkleTree.getHexRoot();

  // Build ownership with proofs
  const ownershipWithProofs = activeOwnership.map(({ owner, tokenId }, index) => {
    const leaf = leaves[index];
    const proof = merkleTree.getHexProof(leaf);
    return {
      tokenId,
      owner,
      leaf: "0x" + leaf.toString("hex"),
      proof,
    };
  });

  return {
    latestBlock,
    merkleRoot,
    activeOwnership,
    uniqueOwnersCount: uniqueOwners.size,
    ownershipWithProofs,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const contractAddress = searchParams.get("contract");
  const format = searchParams.get("format"); // 'csv', 'merkle'
  const refresh = searchParams.get("refresh") === "true";
  const networkParam = searchParams.get("network");
  const network: Network = networkParam === "mainnet" ? "mainnet" : "testnet";

  if (!contractAddress) {
    return NextResponse.json(
      { error: "Missing contract address" },
      { status: 400 }
    );
  }

  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
    return NextResponse.json(
      { error: "Invalid contract address format" },
      { status: 400 }
    );
  }

  try {
    let snapshotBlock: number;
    let merkleRoot: string;
    let activeOwnership: { tokenId: string; owner: string }[];
    let uniqueOwnersCount: number;
    let ownershipWithProofs: {
      tokenId: string;
      owner: string;
      leaf: string;
      proof: string[];
    }[];
    let fromCache = false;

    // Check database cache first (unless refresh is requested)
    const cachedSnapshot = !refresh ? await getSnapshot(contractAddress, network) : null;

    // Check if cache is stale (older than 1 hour)
    const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
    const isStale = cachedSnapshot
      ? Date.now() - new Date(cachedSnapshot.updated_at).getTime() > CACHE_TTL_MS
      : false;

    if (cachedSnapshot && !isStale) {
      const cachedOwnership = await getOwnership(cachedSnapshot.id);

      snapshotBlock = Number(cachedSnapshot.snapshot_block);
      merkleRoot = cachedSnapshot.merkle_root;
      uniqueOwnersCount = cachedSnapshot.unique_owners;
      activeOwnership = cachedOwnership.map((o) => ({
        tokenId: o.token_id,
        owner: o.owner,
      }));
      ownershipWithProofs = cachedOwnership.map((o) => ({
        tokenId: o.token_id,
        owner: o.owner,
        leaf: o.leaf,
        proof: o.proof,
      }));
      fromCache = true;
    } else {
      // Fetch from HyperSync
      const result = await fetchFromHypersync(contractAddress, network);
      snapshotBlock = result.latestBlock;
      merkleRoot = result.merkleRoot;
      activeOwnership = result.activeOwnership;
      uniqueOwnersCount = result.uniqueOwnersCount;
      ownershipWithProofs = result.ownershipWithProofs;

      // Save to database
      await saveSnapshot(
        contractAddress,
        network,
        snapshotBlock,
        merkleRoot,
        activeOwnership.length,
        uniqueOwnersCount,
        ownershipWithProofs
      );
    }

    // If CSV format requested, return CSV
    if (format === "csv") {
      const csvRows = ["tokenId,owner"];
      for (const { tokenId, owner } of activeOwnership) {
        csvRows.push(`${tokenId},${owner}`);
      }
      const csv = csvRows.join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${contractAddress}-snapshot.csv"`,
        },
      });
    }

    // If merkle format requested, return full merkle data with proofs
    if (format === "merkle") {
      const merkleData = {
        contract: contractAddress,
        snapshotBlock,
        merkleRoot,
        totalLeaves: activeOwnership.length,
        leaves: ownershipWithProofs,
      };

      return new NextResponse(JSON.stringify(merkleData, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${contractAddress}-merkle.json"`,
        },
      });
    }

    // Return JSON with analytics and merkle root
    return NextResponse.json({
      contract: contractAddress,
      network,
      snapshotBlock,
      merkleRoot,
      fromCache,
      analytics: {
        totalNfts: activeOwnership.length,
        uniqueOwners: uniqueOwnersCount,
      },
      data: activeOwnership,
    });
  } catch (error) {
    console.error("Snapshot error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch snapshot" },
      { status: 500 }
    );
  }
}
