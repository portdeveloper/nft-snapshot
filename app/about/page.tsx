import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About - NFT Snapshot",
  description: "Learn how NFT Snapshot works and how to use it for your Monad NFT collection",
};

export default function About() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-zinc-950">
      <main className="w-full max-w-2xl">
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
            NFT Snapshot helps Monad projects preserve NFT ownership data before testnet regenesis.
          </p>

          <div className="space-y-8">
            <section>
              <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-100">
                What is NFT Snapshot?
              </h2>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                NFT Snapshot is an official Monad DevRel tool that allows projects to capture
                a complete snapshot of NFT ownership for any ERC-721 collection on Monad testnet.
                This is especially useful before testnet regenesis events, enabling projects to
                redistribute NFTs to their original holders afterward.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-100">
                How It Works
              </h2>
              <ol className="list-inside list-decimal space-y-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                <li>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">Enter Contract Address</span>
                  {" "}- Paste your NFT collection&apos;s contract address
                </li>
                <li>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">Fetch Ownership Data</span>
                  {" "}- We query all Transfer events from the blockchain to reconstruct current ownership
                </li>
                <li>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">Generate Merkle Tree</span>
                  {" "}- A merkle tree is generated from the ownership data for efficient on-chain verification
                </li>
                <li>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">Download & Use</span>
                  {" "}- Export as CSV for airdrops or JSON with merkle proofs for claim contracts
                </li>
              </ol>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-100">
                Export Formats
              </h2>
              <div className="space-y-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">CSV Export</span>
                  {" "}- Simple format with tokenId and owner columns. Perfect for airdrops or manual processing.
                </div>
                <div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">Merkle Tree JSON</span>
                  {" "}- Complete merkle tree data including the root hash and individual proofs for each token.
                  Use this for building claim contracts where users can verify ownership on-chain.
                </div>
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-100">
                Caching
              </h2>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Snapshots are cached in our database for faster subsequent access. Cache automatically
                refreshes if the data is older than 1 hour. You can also manually refresh by clicking
                the &quot;Refresh&quot; button to get the latest ownership data.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-100">
                Shareable URLs
              </h2>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Each snapshot has a shareable URL. Simply copy the URL from your browser after
                fetching a snapshot to share it with others. They&apos;ll see the same snapshot data
                instantly.
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
                {" "}for lightning-fast blockchain data indexing. HyperSync enables us to query
                all Transfer events for any NFT collection in seconds, regardless of how many
                transfers have occurred.
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
