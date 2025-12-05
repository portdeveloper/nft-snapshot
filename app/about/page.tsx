import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About - Token Snapshot",
  description: "Learn how Token Snapshot works for ERC-721, ERC-1155, and ERC-20 tokens on Monad",
};

export default function About() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <main className="w-full max-w-3xl">
        <div className="rounded-2xl bg-white p-8 shadow-sm dark:bg-zinc-900">
          <Link
            href="/"
            className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to Snapshot
          </Link>

          <h1 className="mb-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            How It Works
          </h1>
          <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
            Token Snapshot helps Monad projects preserve token ownership and balance data before testnet regenesis.
          </p>

          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-100">
                What is Token Snapshot?
              </h2>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Token Snapshot is an official Monad DevRel tool that allows projects to capture
                a complete snapshot of token ownership for any ERC-721 (NFT), ERC-1155 (Multi-Token),
                or ERC-20 token on Monad. This is especially useful before testnet regenesis events,
                enabling projects to redistribute tokens to their original holders afterward.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-100">
                Supported Token Types
              </h2>
              <div className="space-y-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">ERC-721 (NFTs)</span>
                  {" "}- Captures ownership of each individual token ID. Results show which address owns each NFT.
                </div>
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">ERC-1155 (Multi-Token)</span>
                  {" "}- Captures balances for all token IDs across all holders. Results show each address,
                  token ID, and balance. Supports both TransferSingle and TransferBatch events.
                </div>
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">ERC-20 (Tokens)</span>
                  {" "}- Captures token balances for all holders. Results show each address and their balance
                  (as raw values without decimal adjustment).
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-100">
                How It Works
              </h2>
              <ol className="list-inside list-decimal space-y-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                <li>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">Select Token Type</span>
                  {" "}- Choose between ERC-721 (NFT), ERC-1155 (Multi-Token), or ERC-20 (Token)
                </li>
                <li>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">Enter Contract Address</span>
                  {" "}- Paste your token contract address
                </li>
                <li>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">Fetch Data</span>
                  {" "}- We query all Transfer events from the blockchain to reconstruct current ownership/balances
                </li>
                <li>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">Download & Use</span>
                  {" "}- Export as CSV for airdrops or further processing
                </li>
              </ol>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-100">
                Export Format
              </h2>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">CSV Export</span>
                {" "}- Simple format for airdrops or manual processing. For ERC-721: tokenId and owner columns.
                For ERC-1155: address, tokenId, and balance columns. For ERC-20: address and balance columns.
                You can generate merkle trees from this data using standard libraries if needed for claim contracts.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-100">
                Shareable URLs
              </h2>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Each snapshot has a shareable URL that includes the contract address, network, and token type.
                Simply copy the URL from your browser after fetching a snapshot to share it with others.
              </p>
            </section>

            <section className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800">
              <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-100">
                Powered by Envio HyperSync
              </h2>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                This tool uses{" "}
                <a
                  href="https://envio.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-2 transition-colors hover:decoration-zinc-500 dark:text-zinc-100 dark:decoration-zinc-600 dark:hover:decoration-zinc-400"
                >
                  Envio HyperSync
                </a>
                {" "}for lightning-fast blockchain data indexing on{" "}
                <span className="font-medium text-zinc-900 dark:text-zinc-100">Monad</span>.
                HyperSync enables us to query all Transfer events for any token in seconds,
                regardless of how many transfers have occurred.
              </p>
            </section>
          </div>

          <div className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-700">
            <Link
              href="/"
              className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Get Started
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
