import { NextRequest, NextResponse } from "next/server";

// Simple semaphore for limiting concurrent HyperSync requests
// Prevents overwhelming the HyperSync API when multiple users query simultaneously
class Semaphore {
  private current = 0;
  private queue: (() => void)[] = [];

  constructor(private readonly max: number) {}

  async acquire(): Promise<boolean> {
    if (this.current < this.max) {
      this.current++;
      return true;
    }
    return false;
  }

  release(): void {
    this.current--;
    if (this.queue.length > 0 && this.current < this.max) {
      this.current++;
      const next = this.queue.shift();
      next?.();
    }
  }

  get available(): number {
    return this.max - this.current;
  }
}

// Limit to 1 concurrent HyperSync fetch when using shared API key
const hypersyncSemaphore = new Semaphore(1);

type Network = "testnet" | "mainnet";

// Transfer(address indexed from, address indexed to, uint256 tokenId/value)
// Same signature for both ERC721 and ERC20
const TRANSFER_EVENT_SIGNATURE =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// ERC-1155 event signatures
// TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)
const TRANSFER_SINGLE_SIGNATURE =
  "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62";
// TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)
const TRANSFER_BATCH_SIGNATURE =
  "0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb";

const HYPERSYNC_URLS: Record<Network, string> = {
  testnet: "https://monad-testnet.hypersync.xyz",
  mainnet: "https://monad.hypersync.xyz",
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

type TokenType = "erc721" | "erc20" | "erc1155";

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

// ERC1155 log interface - operator, from, to indexed; id and value in data
interface HypersyncERC1155Log {
  topic0: string;
  topic1: string; // operator (indexed)
  topic2: string; // from (indexed)
  topic3: string; // to (indexed)
  data: string;   // id and value (TransferSingle) or ids[] and values[] (TransferBatch)
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
  network: Network,
  apiKey: string | undefined
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
      log: ["topic0", "topic2", "topic3"],
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${HYPERSYNC_URLS[network]}/query`, {
      method: "POST",
      headers,
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
  network: Network,
  apiKey: string | undefined
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
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${HYPERSYNC_URLS[network]}/query`, {
      method: "POST",
      headers,
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

async function queryHypersyncERC1155(
  contractAddress: string,
  fromBlock: number,
  network: Network,
  apiKey: string | undefined
): Promise<HypersyncResponse<HypersyncERC1155Log>> {
  const query = {
    from_block: fromBlock,
    logs: [
      {
        address: [contractAddress],
        topics: [[TRANSFER_SINGLE_SIGNATURE, TRANSFER_BATCH_SIGNATURE]],
      },
    ],
    field_selection: {
      log: ["topic0", "topic1", "topic2", "topic3", "data"],
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${HYPERSYNC_URLS[network]}/query`, {
      method: "POST",
      headers,
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

async function getLatestBlock(network: Network, apiKey: string | undefined): Promise<number> {
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${HYPERSYNC_URLS[network]}/height`, {
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to get latest block");
  }

  const data = await response.json();
  return data.height;
}

interface FetchOptions {
  maxIterations?: number;
}

async function fetchERC721FromHypersync(
  contractAddress: string,
  network: Network,
  apiKey: string | undefined,
  options: FetchOptions = {}
) {
  const latestBlock = await getLatestBlock(network, apiKey);
  const ownership = new Map<string, string>();

  let fromBlock = 0;
  let hasMore = true;
  let iterations = 0;
  const maxIterations = options.maxIterations || 10000;

  while (hasMore) {
    if (iterations >= maxIterations) {
      break;
    }

    iterations++;
    const response = await queryHypersyncERC721(contractAddress, fromBlock, network, apiKey);

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
  };
}

async function fetchERC20FromHypersync(
  contractAddress: string,
  network: Network,
  apiKey: string | undefined,
  options: FetchOptions = {}
) {
  const latestBlock = await getLatestBlock(network, apiKey);
  const balances = new Map<string, bigint>();

  let fromBlock = 0;
  let hasMore = true;
  let iterations = 0;
  const maxIterations = options.maxIterations || 10000;

  while (hasMore) {
    if (iterations >= maxIterations) {
      break;
    }

    iterations++;
    const response = await queryHypersyncERC20(contractAddress, fromBlock, network, apiKey);

    if (response.data && response.data.length > 0) {
      for (const block of response.data) {
        if (block.logs) {
          for (const log of block.logs) {
            if (log.topic1 && log.topic2) {
              const value = parseValue(log.data);
              if (value === null) {
                continue;
              }

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
  };
}

// Parse ERC-1155 TransferSingle data field: id (32 bytes) + value (32 bytes)
function parseTransferSingleData(data: string): { tokenId: string; value: bigint } | null {
  if (!data || data.length < 130) return null; // 0x + 64 chars (id) + 64 chars (value)
  try {
    const tokenId = BigInt("0x" + data.slice(2, 66)).toString();
    const value = BigInt("0x" + data.slice(66, 130));
    return { tokenId, value };
  } catch {
    return null;
  }
}

// Parse ERC-1155 TransferBatch data field: ABI-encoded arrays of ids and values
function parseTransferBatchData(data: string): { tokenId: string; value: bigint }[] | null {
  if (!data || data.length < 258) return null; // Minimum: offsets + 2 lengths + 1 id + 1 value
  try {
    // ABI encoding for two dynamic arrays:
    // - offset to ids array (32 bytes)
    // - offset to values array (32 bytes)
    // - ids array: length (32 bytes) + elements
    // - values array: length (32 bytes) + elements
    const idsOffset = Number(BigInt("0x" + data.slice(2, 66)));
    const valuesOffset = Number(BigInt("0x" + data.slice(66, 130)));

    // Read ids array length (at idsOffset)
    const idsLengthStart = 2 + idsOffset * 2;
    const idsLength = Number(BigInt("0x" + data.slice(idsLengthStart, idsLengthStart + 64)));

    // Read values array length (at valuesOffset)
    const valuesLengthStart = 2 + valuesOffset * 2;
    const valuesLength = Number(BigInt("0x" + data.slice(valuesLengthStart, valuesLengthStart + 64)));

    if (idsLength !== valuesLength || idsLength === 0) return null;

    const results: { tokenId: string; value: bigint }[] = [];
    for (let i = 0; i < idsLength; i++) {
      const idStart = idsLengthStart + 64 + i * 64;
      const valueStart = valuesLengthStart + 64 + i * 64;
      const tokenId = BigInt("0x" + data.slice(idStart, idStart + 64)).toString();
      const value = BigInt("0x" + data.slice(valueStart, valueStart + 64));
      results.push({ tokenId, value });
    }
    return results;
  } catch {
    return null;
  }
}

async function fetchERC1155FromHypersync(
  contractAddress: string,
  network: Network,
  apiKey: string | undefined,
  options: FetchOptions = {}
) {
  const latestBlock = await getLatestBlock(network, apiKey);
  // Map: address -> tokenId -> balance
  const balances = new Map<string, Map<string, bigint>>();

  let fromBlock = 0;
  let hasMore = true;
  let iterations = 0;
  const maxIterations = options.maxIterations || 10000;

  while (hasMore) {
    if (iterations >= maxIterations) {
      break;
    }

    iterations++;
    const response = await queryHypersyncERC1155(contractAddress, fromBlock, network, apiKey);

    if (response.data && response.data.length > 0) {
      for (const block of response.data) {
        if (block.logs) {
          for (const log of block.logs) {
            if (!log.topic2 || !log.topic3 || !log.data) continue;

            const from = parseAddress(log.topic2);
            const to = parseAddress(log.topic3);

            let transfers: { tokenId: string; value: bigint }[] = [];

            if (log.topic0 === TRANSFER_SINGLE_SIGNATURE) {
              const parsed = parseTransferSingleData(log.data);
              if (parsed) transfers = [parsed];
            } else if (log.topic0 === TRANSFER_BATCH_SIGNATURE) {
              const parsed = parseTransferBatchData(log.data);
              if (parsed) transfers = parsed;
            }

            for (const { tokenId, value } of transfers) {
              // Subtract from sender
              if (from !== ZERO_ADDRESS) {
                if (!balances.has(from)) balances.set(from, new Map());
                const fromBalances = balances.get(from)!;
                const current = fromBalances.get(tokenId) || 0n;
                fromBalances.set(tokenId, current - value);
              }

              // Add to receiver
              if (to !== ZERO_ADDRESS) {
                if (!balances.has(to)) balances.set(to, new Map());
                const toBalances = balances.get(to)!;
                const current = toBalances.get(tokenId) || 0n;
                toBalances.set(tokenId, current + value);
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

  // Flatten and filter: create (address, tokenId, balance) tuples with positive balances
  const holdings: { address: string; tokenId: string; balance: string }[] = [];
  const uniqueOwners = new Set<string>();
  const uniqueTokenIds = new Set<string>();

  for (const [address, tokenBalances] of balances) {
    for (const [tokenId, balance] of tokenBalances) {
      if (balance > 0n) {
        holdings.push({ address, tokenId, balance: balance.toString() });
        uniqueOwners.add(address);
        uniqueTokenIds.add(tokenId);
      }
    }
  }

  // Sort by tokenId (numeric) then by balance descending
  holdings.sort((a, b) => {
    const tokenDiff = Number(BigInt(a.tokenId) - BigInt(b.tokenId));
    if (tokenDiff !== 0) return tokenDiff;
    return BigInt(b.balance) > BigInt(a.balance) ? 1 : BigInt(b.balance) < BigInt(a.balance) ? -1 : 0;
  });

  return {
    latestBlock,
    holdings,
    uniqueOwnersCount: uniqueOwners.size,
    uniqueTokenIdsCount: uniqueTokenIds.size,
    totalHoldings: holdings.length,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const contractAddress = searchParams.get("contract");
  const format = searchParams.get("format");
  const networkParam = searchParams.get("network");
  const network: Network = networkParam === "mainnet" ? "mainnet" : "testnet";
  const typeParam = searchParams.get("type");
  const tokenType: TokenType = typeParam === "erc20" ? "erc20" : typeParam === "erc1155" ? "erc1155" : "erc721";
  const userApiKey = searchParams.get("apiKey");

  // Use user's API key if provided, otherwise use shared key
  const apiKey = userApiKey || process.env.HYPERSYNC_BEARER_TOKEN;
  const usingOwnKey = !!userApiKey;

  if (!contractAddress) {
    return NextResponse.json({ error: "Missing contract address" }, { status: 400 });
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
    return NextResponse.json({ error: "Invalid contract address format" }, { status: 400 });
  }

  // Only rate limit if using shared API key
  let acquired = true;
  if (!usingOwnKey) {
    acquired = await hypersyncSemaphore.acquire();
    if (!acquired) {
      return NextResponse.json(
        {
          error: "Someone else is currently using the tool. Please wait a moment and try again, or provide your own HyperSync API key to skip the queue.",
          retryAfter: 10,
        },
        {
          status: 503,
          headers: {
            "Retry-After": "10",
          },
        }
      );
    }
  }

  try {
    // Handle ERC20 tokens (no caching)
    if (tokenType === "erc20") {
      // No timeout - fetch complete data for both preview and CSV
      const options: FetchOptions = {};
      const result = await fetchERC20FromHypersync(contractAddress, network, apiKey, options);

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

    // Handle ERC1155 tokens (multi-token)
    if (tokenType === "erc1155") {
      const options: FetchOptions = {};
      const result = await fetchERC1155FromHypersync(contractAddress, network, apiKey, options);

      if (format === "csv") {
        const csvRows = ["address,tokenId,balance"];
        for (const { address, tokenId, balance } of result.holdings) {
          csvRows.push(`${address},${tokenId},${balance}`);
        }
        return new NextResponse(csvRows.join("\n"), {
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="${contractAddress}-erc1155-snapshot.csv"`,
          },
        });
      }

      // Preview response - limit to first 1000 holdings
      const MAX_PREVIEW = 1000;
      const previewData = result.holdings.slice(0, MAX_PREVIEW);

      return NextResponse.json({
        contract: contractAddress,
        tokenType: "erc1155",
        network,
        snapshotBlock: result.latestBlock,
        analytics: {
          totalHoldings: result.totalHoldings,
          uniqueOwners: result.uniqueOwnersCount,
          uniqueTokenIds: result.uniqueTokenIdsCount,
        },
        data: previewData,
      });
    }

    // Handle ERC721 tokens - always fetch fresh data
    const options: FetchOptions = {};
    const result = await fetchERC721FromHypersync(contractAddress, network, apiKey, options);

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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch snapshot" },
      { status: 500 }
    );
  } finally {
    // Only release semaphore if we acquired it (using shared key)
    if (!usingOwnKey) {
      hypersyncSemaphore.release();
    }
  }
}
