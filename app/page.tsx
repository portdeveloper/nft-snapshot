"use client";

import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type Network = "testnet" | "mainnet";
type TokenType = "erc721" | "erc20";

interface CachedCollection {
  contract: string;
  network: Network;
  snapshotBlock: number;
  merkleRoot: string;
  totalNfts: number;
  uniqueOwners: number;
  updatedAt: string;
}

// ERC721 snapshot data
interface ERC721SnapshotData {
  contract: string;
  tokenType: "erc721";
  network: Network;
  snapshotBlock: number;
  merkleRoot: string;
  fromCache?: boolean;
  analytics: {
    totalNfts: number;
    uniqueOwners: number;
  };
  data: { tokenId: string; owner: string }[];
}

// ERC20 snapshot data
interface ERC20SnapshotData {
  contract: string;
  tokenType: "erc20";
  network: Network;
  snapshotBlock: number;
  merkleRoot: string;
  fromCache?: boolean;
  analytics: {
    totalSupply: string;
    holders: number;
  };
  data: { address: string; balance: string }[];
}

type SnapshotData = ERC721SnapshotData | ERC20SnapshotData;

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

function CopyableText({
  text,
  truncate = true,
  className = "",
}: {
  text: string;
  truncate?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayed = truncate
    ? `${text.slice(0, 6)}...${text.slice(-4)}`
    : text;

  return (
    <div className="relative inline-block">
      <button
        onClick={handleCopy}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`group flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 ${className}`}
      >
        <span>{displayed}</span>
        {copied ? (
          <CheckIcon className="text-green-500" />
        ) : (
          <CopyIcon className="opacity-0 transition-opacity group-hover:opacity-100" />
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && !copied && truncate && (
        <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-xs text-white shadow-lg dark:bg-zinc-700">
          {text}
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-900 dark:border-t-zinc-700" />
        </div>
      )}

      {/* Copied toast */}
      {copied && (
        <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-green-600 px-2 py-1 text-xs text-white shadow-lg">
          Copied!
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-green-600" />
        </div>
      )}
    </div>
  );
}

function CopyableAddress({ address }: { address: string }) {
  return <CopyableText text={address} truncate />;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

const SEARCH_HISTORY_KEY = "nft-snapshot-history";
const NETWORK_KEY = "nft-snapshot-network";
const TOKEN_TYPE_KEY = "nft-snapshot-token-type";

function getSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addToSearchHistory(address: string): void {
  const normalized = address.toLowerCase();
  const history = getSearchHistory().filter((a) => a !== normalized);
  history.unshift(normalized); // Add to front
  localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history.slice(0, 20))); // Keep max 20
}

function getSavedNetwork(): Network {
  if (typeof window === "undefined") return "testnet";
  try {
    const stored = localStorage.getItem(NETWORK_KEY);
    return stored === "mainnet" ? "mainnet" : "testnet";
  } catch {
    return "testnet";
  }
}

function saveNetwork(network: Network): void {
  localStorage.setItem(NETWORK_KEY, network);
}

function getSavedTokenType(): TokenType {
  if (typeof window === "undefined") return "erc721";
  try {
    const stored = localStorage.getItem(TOKEN_TYPE_KEY);
    return stored === "erc20" ? "erc20" : "erc721";
  } catch {
    return "erc721";
  }
}

function saveTokenType(tokenType: TokenType): void {
  localStorage.setItem(TOKEN_TYPE_KEY, tokenType);
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contractAddress, setContractAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [collections, setCollections] = useState<CachedCollection[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [network, setNetwork] = useState<Network>("testnet");
  const [tokenType, setTokenType] = useState<TokenType>("erc721");

  // Load search history, network, and token type from localStorage on mount
  useEffect(() => {
    setSearchHistory(getSearchHistory());
    setNetwork(getSavedNetwork());
    setTokenType(getSavedTokenType());
  }, []);

  // Save network to localStorage when it changes
  const handleNetworkChange = (newNetwork: Network) => {
    setNetwork(newNetwork);
    saveNetwork(newNetwork);
    setSnapshot(null); // Clear current snapshot when switching networks
  };

  // Save token type to localStorage when it changes
  const handleTokenTypeChange = (newTokenType: TokenType) => {
    setTokenType(newTokenType);
    saveTokenType(newTokenType);
    setSnapshot(null); // Clear current snapshot when switching token types
  };

  // Fetch cached collections only for addresses in search history (ERC721 only)
  useEffect(() => {
    if (searchHistory.length === 0 || tokenType === "erc20") {
      setCollections([]);
      return;
    }

    async function fetchCollections() {
      try {
        const response = await fetch(`/api/collections?network=${network}`);
        if (response.ok) {
          const data = await response.json();
          const allCollections: CachedCollection[] = data.collections || [];
          // Filter to only show collections in user's search history
          const historySet = new Set(searchHistory);
          const filtered = allCollections.filter((c) =>
            historySet.has(c.contract.toLowerCase())
          );
          // Sort by search history order
          filtered.sort((a, b) => {
            const aIndex = searchHistory.indexOf(a.contract.toLowerCase());
            const bIndex = searchHistory.indexOf(b.contract.toLowerCase());
            return aIndex - bIndex;
          });
          setCollections(filtered);
        }
      } catch {
        // Silently fail - collections are optional
      }
    }
    fetchCollections();
  }, [searchHistory, network, tokenType]);

  const filteredData = useMemo(() => {
    if (!snapshot) return [];
    if (!searchQuery.trim()) return snapshot.data;

    const query = searchQuery.toLowerCase().trim();

    if (snapshot.tokenType === "erc721") {
      return (snapshot.data as { tokenId: string; owner: string }[]).filter(
        (item) =>
          item.tokenId.includes(query) ||
          item.owner.toLowerCase().includes(query)
      );
    } else {
      return (snapshot.data as { address: string; balance: string }[]).filter(
        (item) =>
          item.address.toLowerCase().includes(query) ||
          item.balance.includes(query)
      );
    }
  }, [snapshot, searchQuery]);

  const handleFetch = useCallback(async (refresh = false, addressOverride?: string) => {
    const address = addressOverride || contractAddress;

    if (!address) {
      setError("Please enter a contract address");
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      setError("Invalid contract address format");
      return;
    }

    if (addressOverride) {
      setContractAddress(addressOverride);
    }

    // Update URL with contract address
    router.push(`/?contract=${address}`, { scroll: false });

    setError("");
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setSnapshot(null);
    }
    setSearchQuery("");

    try {
      const url = `/api/snapshot?contract=${address}&network=${network}&type=${tokenType}${refresh ? "&refresh=true" : ""}`;
      const response = await fetch(url);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch snapshot");
      }

      const data: SnapshotData = await response.json();
      setSnapshot(data);

      // Add to search history and refresh history state (only for ERC721)
      if (tokenType === "erc721") {
        addToSearchHistory(address);
        setSearchHistory(getSearchHistory());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [contractAddress, router, network, tokenType]);

  // Load contract from URL on initial mount
  useEffect(() => {
    if (initialLoad) {
      const contractFromUrl = searchParams.get("contract");
      if (contractFromUrl && /^0x[a-fA-F0-9]{40}$/.test(contractFromUrl)) {
        setContractAddress(contractFromUrl);
        handleFetch(false, contractFromUrl);
      }
      setInitialLoad(false);
    }
  }, [initialLoad, searchParams, handleFetch]);

  const handleDownloadCSV = () => {
    if (!snapshot) return;
    window.open(
      `/api/snapshot?contract=${snapshot.contract}&network=${network}&type=${snapshot.tokenType}&format=csv`,
      "_blank"
    );
  };

  const handleDownloadMerkle = () => {
    if (!snapshot) return;
    window.open(
      `/api/snapshot?contract=${snapshot.contract}&network=${network}&type=${snapshot.tokenType}&format=merkle`,
      "_blank"
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <main className="w-full max-w-2xl">
        <div className="rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                {tokenType === "erc721" ? "NFT Snapshot" : "Token Snapshot"}
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {tokenType === "erc721"
                  ? "Get a snapshot of all NFT holders for any collection on Monad"
                  : "Get a snapshot of all token holders for any ERC20 on Monad"}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
              <button
                onClick={() => handleNetworkChange("testnet")}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  network === "testnet"
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                Testnet
              </button>
              <button
                onClick={() => handleNetworkChange("mainnet")}
                className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  network === "mainnet"
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                Mainnet
              </button>
            </div>
          </div>

          {/* Token Type Toggle */}
          <div className="mb-6">
            <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
              <button
                onClick={() => handleTokenTypeChange("erc721")}
                className={`flex-1 cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  tokenType === "erc721"
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                ERC-721 (NFT)
              </button>
              <button
                onClick={() => handleTokenTypeChange("erc20")}
                className={`flex-1 cursor-pointer rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  tokenType === "erc20"
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                ERC-20 (Token)
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="contract"
                className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Contract Address
              </label>
              <div className="flex gap-3">
                <input
                  id="contract"
                  type="text"
                  placeholder="0x..."
                  value={contractAddress}
                  onChange={(e) => setContractAddress(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !loading && handleFetch()}
                  disabled={loading}
                  className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-500"
                />
                <button
                  onClick={() => handleFetch()}
                  disabled={loading}
                  className="min-w-[100px] cursor-pointer rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {loading ? "Loading..." : "Fetch"}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            {/* Example contract - only show for ERC721 */}
            {!snapshot && !loading && tokenType === "erc721" && (
              <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span>Try it out:</span>
                <button
                  onClick={() => handleFetch(false, network === "mainnet"
                    ? "0x9f8514cebee138b61806d4651f51d26c8098b463"
                    : "0x78eD9A576519024357aB06D9834266a04c9634b7"
                  )}
                  className="cursor-pointer font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-2 transition-colors hover:text-zinc-900 hover:decoration-zinc-500 dark:text-zinc-300 dark:decoration-zinc-600 dark:hover:text-zinc-100 dark:hover:decoration-zinc-400"
                >
                  The Daks
                </button>
              </div>
            )}

            {/* Recent Searches - only show for ERC721 with cached data */}
            {!snapshot && !loading && tokenType === "erc721" && collections.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Recent searches
                </p>
                <div className="mt-3 space-y-2">
                  {collections.map((collection) => (
                    <button
                      key={collection.contract}
                      onClick={() => handleFetch(false, collection.contract)}
                      className="group flex w-full cursor-pointer items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-left transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-sm text-zinc-900 dark:text-zinc-100">
                          {collection.contract}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500 transition-colors dark:text-zinc-400 dark:group-hover:text-zinc-200">
                          {collection.totalNfts.toLocaleString()} NFTs · {collection.uniqueOwners.toLocaleString()} owners · Block {collection.snapshotBlock.toLocaleString()}
                        </p>
                      </div>
                      <span className="ml-3 flex-shrink-0 text-xs text-zinc-400 transition-colors dark:text-zinc-500 dark:group-hover:text-zinc-300">
                        {formatTimeAgo(collection.updatedAt)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ERC20 info notice */}
            {!snapshot && !loading && tokenType === "erc20" && (
              <div className="rounded-lg bg-amber-50 px-4 py-3 dark:bg-amber-900/20">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  ERC20 snapshots are not cached and will be fetched fresh each time. Balances are shown as raw values (without decimal adjustment).
                </p>
              </div>
            )}
          </div>

          {loading && (
            <div className="mt-8">
              <p className="mb-3 text-center text-sm text-zinc-500 dark:text-zinc-400">
                This can take up to 10 seconds. Enjoy the Minecraft parkour video.
              </p>
              <div className="overflow-hidden rounded-xl">
                <video
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="auto"
                  className="aspect-video w-full object-cover"
                  src="/loading.mp4"
                />
              </div>
            </div>
          )}

          {snapshot && !loading && (
            <div className="mt-8 space-y-6">
              {/* Cache indicator and refresh - only for ERC721 */}
              {snapshot.fromCache && snapshot.tokenType === "erc721" && (
                <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 dark:bg-blue-900/20">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Loaded from cache
                  </p>
                  <button
                    onClick={() => handleFetch(true)}
                    disabled={refreshing}
                    className="flex cursor-pointer items-center gap-1.5 rounded-md bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-200 disabled:opacity-50 dark:bg-blue-800 dark:text-blue-200 dark:hover:bg-blue-700"
                  >
                    <RefreshIcon className={refreshing ? "animate-spin" : ""} />
                    {refreshing ? "Refreshing..." : "Refresh"}
                  </button>
                </div>
              )}

              {/* Analytics Cards - conditional based on token type */}
              {snapshot.tokenType === "erc721" ? (
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Total NFTs
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                      {snapshot.analytics.totalNfts.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Unique Owners
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                      {snapshot.analytics.uniqueOwners.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Snapshot Block
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                      {snapshot.snapshotBlock.toLocaleString()}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Total Supply
                    </p>
                    <p className="mt-1 truncate text-lg font-semibold text-zinc-900 dark:text-zinc-100" title={snapshot.analytics.totalSupply}>
                      {snapshot.analytics.totalSupply}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Holders
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                      {snapshot.analytics.holders.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                      Snapshot Block
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                      {snapshot.snapshotBlock.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {/* Merkle Root */}
              <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Merkle Root
                </p>
                <CopyableText text={snapshot.merkleRoot} truncate={false} className="text-xs" />
              </div>

              {/* Search and Preview */}
              <div>
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Preview
                  </h2>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder={snapshot.tokenType === "erc721" ? "Search by token ID or owner..." : "Search by address or balance..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-500 sm:w-64"
                    />
                  </div>
                </div>

                <div className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {searchQuery ? (
                    <>
                      Found {filteredData.length.toLocaleString()} results
                      {filteredData.length > 50 && " (showing first 50)"}
                    </>
                  ) : (
                    <>
                      Showing first 50 of{" "}
                      {snapshot.data.length.toLocaleString()}
                    </>
                  )}
                </div>

                <div className="max-h-[500px] overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-800">
                      <tr>
                        {snapshot.tokenType === "erc721" ? (
                          <>
                            <th className="px-4 py-2.5 text-left font-medium text-zinc-600 dark:text-zinc-400">
                              Token ID
                            </th>
                            <th className="px-4 py-2.5 text-left font-medium text-zinc-600 dark:text-zinc-400">
                              Owner
                            </th>
                          </>
                        ) : (
                          <>
                            <th className="px-4 py-2.5 text-left font-medium text-zinc-600 dark:text-zinc-400">
                              Address
                            </th>
                            <th className="px-4 py-2.5 text-right font-medium text-zinc-600 dark:text-zinc-400">
                              Balance
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {filteredData.length === 0 ? (
                        <tr>
                          <td
                            colSpan={2}
                            className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400"
                          >
                            No results found
                          </td>
                        </tr>
                      ) : snapshot.tokenType === "erc721" ? (
                        (filteredData as { tokenId: string; owner: string }[]).slice(0, 50).map((item) => (
                          <tr
                            key={item.tokenId}
                            className="bg-white dark:bg-zinc-900"
                          >
                            <td className="px-4 py-2.5 font-mono text-zinc-900 dark:text-zinc-100">
                              {item.tokenId}
                            </td>
                            <td className="px-4 py-2">
                              <CopyableAddress address={item.owner} />
                            </td>
                          </tr>
                        ))
                      ) : (
                        (filteredData as { address: string; balance: string }[]).slice(0, 50).map((item) => (
                          <tr
                            key={item.address}
                            className="bg-white dark:bg-zinc-900"
                          >
                            <td className="px-4 py-2">
                              <CopyableAddress address={item.address} />
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-zinc-900 dark:text-zinc-100">
                              {item.balance}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Download Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleDownloadCSV}
                  className="flex-1 cursor-pointer rounded-lg bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Download CSV
                </button>
                <button
                  onClick={handleDownloadMerkle}
                  className="flex-1 cursor-pointer rounded-lg border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                >
                  Download Merkle Tree
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-6 flex items-center justify-center gap-4 text-xs text-zinc-400 dark:text-zinc-500">
          <Link
            href="/about"
            className="transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            How it works
          </Link>
          <span>·</span>
          <span>
            Powered by{" "}
            <a
              href="https://envio.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-zinc-300 underline-offset-2 transition-colors hover:text-zinc-600 dark:decoration-zinc-600 dark:hover:text-zinc-300"
            >
              Envio HyperSync
            </a>
          </span>
        </footer>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="w-full max-w-2xl">
          <div className="overflow-hidden rounded-2xl bg-zinc-900">
            <video
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              className="aspect-video w-full object-cover"
              src="/loading.mp4"
            />
          </div>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
