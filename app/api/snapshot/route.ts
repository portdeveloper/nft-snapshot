import { NextRequest, NextResponse } from "next/server";
type Network = "testnet" | "mainnet";

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
  return "0x" + topic.slice(-40).toLowerCase();
}

function parseTokenId(topic: string): string {
  return BigInt(topic).toString();
}

function parseValue(data: string): bigint | null {
  if (!data || data === "0x" || data.length <= 2) {
    return null;
  }
  try {
    return BigInt(data);
  } catch {
    return null;
  }
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${HYPERSYNC_URLS[network]}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.HYPERSYNC_BEARER_TOKEN}`,
      },
      body: JSON.stringify(query),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HyperSync error: ${response.status} - ${text}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("HyperSync request timed out after 30 seconds");
    }
    throw error;
  }
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
      log: ["topic0", "topic1", "topic2", "data"],
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${HYPERSYNC_URLS[network]}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.HYPERSYNC_BEARER_TOKEN}`,
      },
      body: JSON.stringify(query),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HyperSync error: ${response.status} - ${text}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("HyperSync request timed out after 30 seconds");
    }
    throw error;
  }
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

interface FetchOptions {
  timeoutMs?: number; // undefined = no timeout (for CSV downloads)
  maxIterations?: number;
}

async function fetchERC721FromHypersync(
  contractAddress: string,
  network: Network,
  options: FetchOptions = {}
) {
  const latestBlock = await getLatestBlock(network);
  const ownership = new Map<string, string>();

  let fromBlock = 0;
  let hasMore = true;
  let iterations = 0;
  const maxIterations = options.maxIterations || 10000;
  const startTime = Date.now();
  const timeoutMs = options.timeoutMs;

  while (hasMore) {
    if (iterations >= maxIterations) {
      console.warn(`ERC721 fetch hit iteration limit (${maxIterations}) for ${contractAddress}`);
      break;
    }
    if (timeoutMs && Date.now() - startTime > timeoutMs) {
      console.warn(`ERC721 fetch hit time limit (${timeoutMs}ms) for ${contractAddress}`);
      break;
    }

    iterations++;
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

  const wasLimited = iterations >= maxIterations || (timeoutMs ? Date.now() - startTime > timeoutMs : false);
  console.log(`ERC721 fetch completed: ${iterations} iterations, ${ownership.size} tokens, ${Date.now() - startTime}ms, limited: ${wasLimited}`);

  // Filter out burned tokens and sort
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

  return {
    latestBlock,
    activeOwnership,
    uniqueOwnersCount: uniqueOwners.size,
    wasLimited,
  };
}

async function fetchERC20FromHypersync(
  contractAddress: string,
  network: Network,
  options: FetchOptions = {}
) {
  const latestBlock = await getLatestBlock(network);
  const balances = new Map<string, bigint>();

  let fromBlock = 0;
  let hasMore = true;
  let iterations = 0;
  let totalLogs = 0;
  let validLogs = 0;
  let skippedLogs = 0;
  const maxIterations = options.maxIterations || 10000;
  const startTime = Date.now();
  const timeoutMs = options.timeoutMs;

  while (hasMore) {
    if (iterations >= maxIterations) {
      console.warn(`ERC20 fetch hit iteration limit (${maxIterations}) for ${contractAddress}`);
      break;
    }
    if (timeoutMs && Date.now() - startTime > timeoutMs) {
      console.warn(`ERC20 fetch hit time limit (${timeoutMs}ms) for ${contractAddress}`);
      break;
    }

    iterations++;
    const response = await queryHypersyncERC20(contractAddress, fromBlock, network);

    if (response.data && response.data.length > 0) {
      for (const block of response.data) {
        if (block.logs) {
          totalLogs += block.logs.length;
          for (const log of block.logs) {
            if (log.topic1 && log.topic2) {
              const value = parseValue(log.data);
              if (value === null) {
                skippedLogs++;
                continue;
              }
              validLogs++;

              const from = parseAddress(log.topic1);
              const to = parseAddress(log.topic2);

              if (from !== ZERO_ADDRESS) {
                const currentFrom = balances.get(from) || 0n;
                balances.set(from, currentFrom - value);
              }

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

  const wasLimited = iterations >= maxIterations || (timeoutMs ? Date.now() - startTime > timeoutMs : false);
  console.log(`ERC20 fetch completed: ${iterations} iterations, ${totalLogs} logs (${validLogs} valid, ${skippedLogs} skipped), ${Date.now() - startTime}ms, limited: ${wasLimited}`);

  // Filter and sort by balance descending
  const activeBalances: { address: string; balance: string }[] = [];
  const sortedEntries = Array.from(balances.entries())
    .filter(([, balance]) => balance > 0n)
    .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0));

  for (const [address, balance] of sortedEntries) {
    activeBalances.push({ address, balance: balance.toString() });
  }

  const totalSupply = sortedEntries.reduce((sum, [, bal]) => sum + bal, 0n);

  return {
    latestBlock,
    activeBalances,
    totalSupply: totalSupply.toString(),
    holdersCount: activeBalances.length,
    wasLimited,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const contractAddress = searchParams.get("contract");
  const format = searchParams.get("format");
  const networkParam = searchParams.get("network");
  const network: Network = networkParam === "mainnet" ? "mainnet" : "testnet";
  const typeParam = searchParams.get("type");
  const tokenType: TokenType = typeParam === "erc20" ? "erc20" : "erc721";

  if (!contractAddress) {
    return NextResponse.json({ error: "Missing contract address" }, { status: 400 });
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
    return NextResponse.json({ error: "Invalid contract address format" }, { status: 400 });
  }

  try {
    // Handle ERC20 tokens (no caching)
    if (tokenType === "erc20") {
      // No timeout - fetch complete data for both preview and CSV
      const options: FetchOptions = {};
      const result = await fetchERC20FromHypersync(contractAddress, network, options);

      if (format === "csv") {
        const csvRows = ["address,balance"];
        for (const { address, balance } of result.activeBalances) {
          csvRows.push(`${address},${balance}`);
        }
        return new NextResponse(csvRows.join("\n"), {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="${contractAddress}-erc20-snapshot.csv"`,
          },
        });
      }

      // Preview response - limit to top 1000 holders
      const MAX_PREVIEW = 1000;
      const previewData = result.activeBalances.slice(0, MAX_PREVIEW);

      return NextResponse.json({
        contract: contractAddress,
        tokenType: "erc20",
        network,
        snapshotBlock: result.latestBlock,
        analytics: {
          totalSupply: result.totalSupply,
          holders: result.holdersCount,
        },
        data: previewData,
      });
    }

    // Handle ERC721 tokens - always fetch fresh data
    const options: FetchOptions = {};
    const result = await fetchERC721FromHypersync(contractAddress, network, options);

    if (format === "csv") {
      const csvRows = ["tokenId,owner"];
      for (const { tokenId, owner } of result.activeOwnership) {
        csvRows.push(`${tokenId},${owner}`);
      }
      return new NextResponse(csvRows.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${contractAddress}-snapshot.csv"`,
        },
      });
    }

    // Preview response - limit to first 1000
    const MAX_PREVIEW = 1000;
    const previewData = result.activeOwnership.slice(0, MAX_PREVIEW);

    return NextResponse.json({
      contract: contractAddress,
      tokenType: "erc721",
      network,
      snapshotBlock: result.latestBlock,
      analytics: {
        totalNfts: result.activeOwnership.length,
        uniqueOwners: result.uniqueOwnersCount,
      },
      data: previewData,
    });
  } catch (error) {
    console.error("Snapshot error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch snapshot" },
      { status: 500 }
    );
  }
}
