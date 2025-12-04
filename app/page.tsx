"use client";

import { useState, useMemo, useEffect } from "react";

const HISTORY_KEY = "nft-snapshot-history";
const MAX_HISTORY = 5;

interface HistoryItem {
  address: string;
  timestamp: number;
}

function getHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addToHistory(address: string) {
  const history = getHistory().filter(
    (item) => item.address.toLowerCase() !== address.toLowerCase()
  );
  history.unshift({ address: address.toLowerCase(), timestamp: Date.now() });
  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(history.slice(0, MAX_HISTORY))
  );
}

function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

interface SnapshotData {
  contract: string;
  snapshotBlock: number;
  merkleRoot: string;
  analytics: {
    totalNfts: number;
    uniqueOwners: number;
  };
  data: { tokenId: string; owner: string }[];
}

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

function CopyableText({
  text,
  truncate = true,
}: {
  text: string;
  truncate?: boolean;
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
        className="group flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
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

export default function Home() {
  const [contractAddress, setContractAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setHistory(getHistory());
  }, []);

  const filteredData = useMemo(() => {
    if (!snapshot) return [];
    if (!searchQuery.trim()) return snapshot.data;

    const query = searchQuery.toLowerCase().trim();
    return snapshot.data.filter(
      (item) =>
        item.tokenId.includes(query) ||
        item.owner.toLowerCase().includes(query)
    );
  }, [snapshot, searchQuery]);

  const handleFetch = async () => {
    if (!contractAddress) {
      setError("Please enter a contract address");
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
      setError("Invalid contract address format");
      return;
    }

    setError("");
    setLoading(true);
    setSnapshot(null);
    setSearchQuery("");

    try {
      const response = await fetch(
        `/api/snapshot?contract=${contractAddress}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch snapshot");
      }

      const data: SnapshotData = await response.json();
      setSnapshot(data);
      addToHistory(contractAddress);
      setHistory(getHistory());
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadCSV = () => {
    if (!snapshot) return;
    window.open(
      `/api/snapshot?contract=${snapshot.contract}&format=csv`,
      "_blank"
    );
  };

  const handleDownloadMerkle = () => {
    if (!snapshot) return;
    window.open(
      `/api/snapshot?contract=${snapshot.contract}&format=merkle`,
      "_blank"
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <main className="w-full max-w-2xl">
        <div className="rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
          <h1 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            NFT Snapshot
          </h1>
          <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
            Get a snapshot of all NFT holders for any collection on Monad
          </p>

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
                  onClick={handleFetch}
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

            {/* Search History */}
            {!snapshot && !loading && history.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Recent searches
                  </p>
                  <button
                    onClick={() => {
                      clearHistory();
                      setHistory([]);
                    }}
                    className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                  >
                    Clear
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {history.map((item) => (
                    <button
                      key={item.address}
                      onClick={() => {
                        setContractAddress(item.address);
                      }}
                      className="cursor-pointer rounded-md bg-zinc-100 px-3 py-1.5 font-mono text-xs text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      {item.address.slice(0, 6)}...{item.address.slice(-4)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {loading && (
            <div className="mt-8 flex flex-col items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                Fetching snapshot data...
              </p>
            </div>
          )}

          {snapshot && !loading && (
            <div className="mt-8 space-y-6">
              {/* Analytics Cards */}
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

              {/* Merkle Root */}
              <div className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Merkle Root
                </p>
                <div className="mt-1 flex items-center">
                  <code className="block w-full break-all rounded bg-zinc-100 px-2 py-1.5 font-mono text-sm text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200">
                    {snapshot.merkleRoot}
                  </code>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(snapshot.merkleRoot);
                    }}
                    className="ml-2 flex-shrink-0 cursor-pointer rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-600 dark:hover:text-zinc-300"
                    title="Copy merkle root"
                  >
                    <CopyIcon />
                  </button>
                </div>
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
                      placeholder="Search by token ID or owner..."
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
                    <thead className="sticky top-0">
                      <tr className="bg-zinc-50 dark:bg-zinc-800">
                        <th className="px-4 py-2.5 text-left font-medium text-zinc-600 dark:text-zinc-400">
                          Token ID
                        </th>
                        <th className="px-4 py-2.5 text-left font-medium text-zinc-600 dark:text-zinc-400">
                          Owner
                        </th>
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
                      ) : (
                        filteredData.slice(0, 50).map((item) => (
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
      </main>
    </div>
  );
}
