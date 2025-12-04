import { NextRequest, NextResponse } from "next/server";
import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";
import { getSnapshot, getOwnership, saveSnapshot, Network } from "@/app/lib/db";

// Transfer(address indexed from, address indexed to, uint256 tokenId/value)
// Same signature for both ERC721 and ERC20
const TRANSFER_EVENT_SIGNATURE =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const HYPERSYNC_URLS: Record<Network, string> = {
  testnet: "https://monad-testnet.hypersync.xyz",
  mainnet: "https://monad.hypersync.xyz",
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

type TokenType = "erc721" | "erc20";

function parseAddress(topic: string): string {
  // Topics are 32 bytes, addresses are 20 bytes (40 hex chars)
  return "0x" + topic.slice(-40).toLowerCase();
}

function parseTokenId(topic: string): string {
  return BigInt(topic).toString();
}

function parseValue(data: string): bigint {
  // Data field contains the uint256 value (for ERC20)
  return BigInt(data);
}

// Create a leaf for ERC721 merkle tree: keccak256(owner + tokenId)
function createERC721Leaf(owner: string, tokenId: string): Buffer {
  const ownerBytes = Buffer.from(owner.slice(2).padStart(40, "0"), "hex");
  const tokenIdHex = BigInt(tokenId).toString(16).padStart(64, "0");
  const tokenIdBytes = Buffer.from(tokenIdHex, "hex");
  const packed = Buffer.concat([ownerBytes, tokenIdBytes]);
  return keccak256(packed);
}

// Create a leaf for ERC20 merkle tree: keccak256(address + balance)
function createERC20Leaf(address: string, balance: string): Buffer {
  const addressBytes = Buffer.from(address.slice(2).padStart(40, "0"), "hex");
  const balanceHex = BigInt(balance).toString(16).padStart(64, "0");
  const balanceBytes = Buffer.from(balanceHex, "hex");
  const packed = Buffer.concat([addressBytes, balanceBytes]);
  return keccak256(packed);
}

// ERC721 log interface - tokenId is indexed (topic3)
interface HypersyncERC721Log {
  topic0: string;
  topic1: string;
  topic2: string;
  topic3: string;
}

// ERC20 log interface - value is NOT indexed (data field)
interface HypersyncERC20Log {
  topic0: string;
  topic1: string;
  topic2: string;
  data: string;
}

interface HypersyncDataBlock<T> {
  logs: T[];
}

interface HypersyncResponse<T> {
  data: HypersyncDataBlock<T>[];
  next_block?: number;
}

async function queryHypersyncERC721(
  contractAddress: string,
  fromBlock: number,
  network: Network
): Promise<HypersyncResponse<HypersyncERC721Log>> {
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

async function queryHypersyncERC20(
  contractAddress: string,
  fromBlock: number,
  network: Network
): Promise<HypersyncResponse<HypersyncERC20Log>> {
  const query = {
    from_block: fromBlock,
    logs: [
      {
        address: [contractAddress],
        topics: [[TRANSFER_EVENT_SIGNATURE]],
      },
    ],
    field_selection: {
      // For ERC20, value is in data field (not indexed)
      log: ["topic0", "topic1", "topic2", "data"],
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

async function fetchERC721FromHypersync(contractAddress: string, network: Network) {
  const latestBlock = await getLatestBlock(network);

  // Map to track current ownership: tokenId -> owner
  const ownership = new Map<string, string>();

  let fromBlock = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await queryHypersyncERC721(contractAddress, fromBlock, network);

    if (response.data && response.data.length > 0) {
      for (const block of response.data) {
        if (block.logs) {
          for (const log of block.logs) {
            if (log.topic2 && log.topic3) {
              const to = parseAddress(log.topic2);
              const tokenId = parseTokenId(log.topic3);
              ownership.set(tokenId, to);
            }
          }
        }
      }
    }

    if (response.next_block && response.next_block > fromBlock) {
      fromBlock = response.next_block;
    } else {
      hasMore = false;
    }

    if (!response.data?.length && !response.next_block) {
      hasMore = false;
    }
  }

  // Filter out burned tokens
  const activeOwnership: { tokenId: string; owner: string }[] = [];
  const uniqueOwners = new Set<string>();

  const sortedTokenIds = Array.from(ownership.keys()).sort(
    (a, b) => Number(BigInt(a) - BigInt(b))
  );

  for (const tokenId of sortedTokenIds) {
    const owner = ownership.get(tokenId)!;
    if (owner !== ZERO_ADDRESS) {
      activeOwnership.push({ tokenId, owner });
      uniqueOwners.add(owner);
    }
  }

  // Generate merkle tree
  const leaves = activeOwnership.map(({ owner, tokenId }) =>
    createERC721Leaf(owner, tokenId)
  );
  const merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const merkleRoot = merkleTree.getHexRoot();

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

async function fetchERC20FromHypersync(contractAddress: string, network: Network) {
  const latestBlock = await getLatestBlock(network);

  // Map to track balances: address -> balance (as bigint for precision)
  const balances = new Map<string, bigint>();

  let fromBlock = 0;
  let hasMore = true;

  while (hasMore) {
    const response = await queryHypersyncERC20(contractAddress, fromBlock, network);

    if (response.data && response.data.length > 0) {
      for (const block of response.data) {
        if (block.logs) {
          for (const log of block.logs) {
            if (log.topic1 && log.topic2 && log.data) {
              const from = parseAddress(log.topic1);
              const to = parseAddress(log.topic2);
              const value = parseValue(log.data);

              // Subtract from sender (if not mint from zero address)
              if (from !== ZERO_ADDRESS) {
                const currentFrom = balances.get(from) || 0n;
                balances.set(from, currentFrom - value);
              }

              // Add to receiver (if not burn to zero address)
              if (to !== ZERO_ADDRESS) {
                const currentTo = balances.get(to) || 0n;
                balances.set(to, currentTo + value);
              }
            }
          }
        }
      }
    }

    if (response.next_block && response.next_block > fromBlock) {
      fromBlock = response.next_block;
    } else {
      hasMore = false;
    }

    if (!response.data?.length && !response.next_block) {
      hasMore = false;
    }
  }

  // Filter out zero/negative balances and convert to array
  const activeBalances: { address: string; balance: string }[] = [];

  // Sort by balance descending (largest holders first)
  const sortedEntries = Array.from(balances.entries())
    .filter(([, balance]) => balance > 0n)
    .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0));

  for (const [address, balance] of sortedEntries) {
    activeBalances.push({ address, balance: balance.toString() });
  }

  // Calculate total supply
  const totalSupply = sortedEntries.reduce((sum, [, bal]) => sum + bal, 0n);

  // Generate merkle tree
  const leaves = activeBalances.map(({ address, balance }) =>
    createERC20Leaf(address, balance)
  );
  const merkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const merkleRoot = merkleTree.getHexRoot();

  const balancesWithProofs = activeBalances.map(({ address, balance }, index) => {
    const leaf = leaves[index];
    const proof = merkleTree.getHexProof(leaf);
    return {
      address,
      balance,
      leaf: "0x" + leaf.toString("hex"),
      proof,
    };
  });

  return {
    latestBlock,
    merkleRoot,
    activeBalances,
    totalSupply: totalSupply.toString(),
    holdersCount: activeBalances.length,
    balancesWithProofs,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const contractAddress = searchParams.get("contract");
  const format = searchParams.get("format"); // 'csv', 'merkle'
  const refresh = searchParams.get("refresh") === "true";
  const networkParam = searchParams.get("network");
  const network: Network = networkParam === "mainnet" ? "mainnet" : "testnet";
  const typeParam = searchParams.get("type");
  const tokenType: TokenType = typeParam === "erc20" ? "erc20" : "erc721";

  if (!contractAddress) {
    return NextResponse.json(
      { error: "Missing contract address" },
      { status: 400 }
    );
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
    return NextResponse.json(
      { error: "Invalid contract address format" },
      { status: 400 }
    );
  }

  try {
    // Handle ERC20 tokens (no caching)
    if (tokenType === "erc20") {
      const result = await fetchERC20FromHypersync(contractAddress, network);

      if (format === "csv") {
        const csvRows = ["address,balance"];
        for (const { address, balance } of result.activeBalances) {
          csvRows.push(`${address},${balance}`);
        }
        const csv = csvRows.join("\n");

        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="${contractAddress}-erc20-snapshot.csv"`,
          },
        });
      }

      if (format === "merkle") {
        const merkleData = {
          contract: contractAddress,
          tokenType: "erc20",
          snapshotBlock: result.latestBlock,
          merkleRoot: result.merkleRoot,
          totalLeaves: result.activeBalances.length,
          leaves: result.balancesWithProofs,
        };

        return new NextResponse(JSON.stringify(merkleData, null, 2), {
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="${contractAddress}-erc20-merkle.json"`,
          },
        });
      }

      return NextResponse.json({
        contract: contractAddress,
        tokenType: "erc20",
        network,
        snapshotBlock: result.latestBlock,
        merkleRoot: result.merkleRoot,
        fromCache: false,
        analytics: {
          totalSupply: result.totalSupply,
          holders: result.holdersCount,
        },
        data: result.activeBalances,
      });
    }

    // Handle ERC721 tokens (with caching)
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

    const cachedSnapshot = !refresh ? await getSnapshot(contractAddress, network) : null;

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
      const result = await fetchERC721FromHypersync(contractAddress, network);
      snapshotBlock = result.latestBlock;
      merkleRoot = result.merkleRoot;
      activeOwnership = result.activeOwnership;
      uniqueOwnersCount = result.uniqueOwnersCount;
      ownershipWithProofs = result.ownershipWithProofs;

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

    if (format === "merkle") {
      const merkleData = {
        contract: contractAddress,
        tokenType: "erc721",
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

    return NextResponse.json({
      contract: contractAddress,
      tokenType: "erc721",
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
