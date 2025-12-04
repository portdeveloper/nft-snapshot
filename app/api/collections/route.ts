import { NextResponse } from "next/server";
import { getAllSnapshots } from "@/app/lib/db";

export async function GET() {
  try {
    const snapshots = await getAllSnapshots();
    return NextResponse.json({
      collections: snapshots.map((s) => ({
        contract: s.contract_address,
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
