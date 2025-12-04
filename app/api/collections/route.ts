import { NextRequest, NextResponse } from "next/server";
import { getAllSnapshots, Network } from "@/app/lib/db";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const networkParam = searchParams.get("network");
  const network: Network | undefined = networkParam === "mainnet" ? "mainnet" : networkParam === "testnet" ? "testnet" : undefined;

  try {
    // Only ERC721 snapshots are cached in the database
    const snapshots = await getAllSnapshots(network);
    return NextResponse.json({
      collections: snapshots.map((s) => ({
        contract: s.contract_address,
        tokenType: "erc721",
        network: s.network,
        snapshotBlock: Number(s.snapshot_block),
        merkleRoot: s.merkle_root,
        totalNfts: s.total_nfts,
        uniqueOwners: s.unique_owners,
        updatedAt: s.updated_at,
      })),
    });
  } catch (error) {
    console.error("Collections fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch collections" },
      { status: 500 }
    );
  }
}
