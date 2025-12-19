# Token Snapshot

Capture ownership snapshots for ERC-721, ERC-1155, and ERC-20 tokens on Monad.

## Features

- **ERC-721 (NFT)**: Get token ID → owner mappings
- **ERC-1155 (Multi-Token)**: Get address → token ID → balance mappings
- **ERC-20**: Get holder balances sorted by amount
- **CSV Export**: Download snapshots for airdrops or analysis
- **Shareable URLs**: Each snapshot has a unique URL with contract, network, and token type

## Getting Started

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Add your HYPERSYNC_BEARER_TOKEN

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Description |
|----------|-------------|
| `HYPERSYNC_BEARER_TOKEN` | Your [Envio HyperSync](https://envio.dev/app/api-tokens) API key |

## Tech Stack

- [Next.js](https://nextjs.org) - React framework
- [Envio HyperSync](https://envio.dev) - Blockchain data indexing
- [Tailwind CSS](https://tailwindcss.com) - Styling

## License

MIT
