import { sql } from "@vercel/postgres";

export type Network = "testnet" | "mainnet";

export async function initializeDatabase() {
  await sql`
    CREATE TABLE IF NOT EXISTS snapshots (
      id SERIAL PRIMARY KEY,
      contract_address VARCHAR(42) NOT NULL,
      network VARCHAR(10) NOT NULL DEFAULT 'testnet',
      snapshot_block BIGINT NOT NULL,
      merkle_root VARCHAR(66) NOT NULL,
      total_nfts INTEGER NOT NULL,
      unique_owners INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(contract_address, network)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ownership (
      id SERIAL PRIMARY KEY,
      snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
      token_id VARCHAR(78) NOT NULL,
      owner VARCHAR(42) NOT NULL,
      leaf VARCHAR(66) NOT NULL,
      proof TEXT[] NOT NULL
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_ownership_snapshot_id ON ownership(snapshot_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_snapshots_contract_network ON snapshots(contract_address, network)
  `;
}

export interface StoredSnapshot {
  id: number;
  contract_address: string;
  network: Network;
  snapshot_block: number;
  merkle_root: string;
  total_nfts: number;
  unique_owners: number;
  created_at: Date;
  updated_at: Date;
}

export interface StoredOwnership {
  token_id: string;
  owner: string;
  leaf: string;
  proof: string[];
}

export async function getSnapshot(
  contractAddress: string,
  network: Network = "testnet"
): Promise<StoredSnapshot | null> {
  const result = await sql<StoredSnapshot>`
    SELECT * FROM snapshots
    WHERE contract_address = ${contractAddress.toLowerCase()}
    AND network = ${network}
  `;
  return result.rows[0] || null;
}

export async function getOwnership(
  snapshotId: number
): Promise<StoredOwnership[]> {
  const result = await sql<StoredOwnership>`
    SELECT token_id, owner, leaf, proof FROM ownership
    WHERE snapshot_id = ${snapshotId}
    ORDER BY CAST(token_id AS NUMERIC)
  `;
  return result.rows;
}

export async function saveSnapshot(
  contractAddress: string,
  network: Network,
  snapshotBlock: number,
  merkleRoot: string,
  totalNfts: number,
  uniqueOwners: number,
  ownership: { tokenId: string; owner: string; leaf: string; proof: string[] }[]
): Promise<StoredSnapshot> {
  // Upsert snapshot
  const snapshotResult = await sql<StoredSnapshot>`
    INSERT INTO snapshots (contract_address, network, snapshot_block, merkle_root, total_nfts, unique_owners)
    VALUES (${contractAddress.toLowerCase()}, ${network}, ${snapshotBlock}, ${merkleRoot}, ${totalNfts}, ${uniqueOwners})
    ON CONFLICT (contract_address, network)
    DO UPDATE SET
      snapshot_block = ${snapshotBlock},
      merkle_root = ${merkleRoot},
      total_nfts = ${totalNfts},
      unique_owners = ${uniqueOwners},
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;

  const snapshot = snapshotResult.rows[0];

  // Delete old ownership data
  await sql`DELETE FROM ownership WHERE snapshot_id = ${snapshot.id}`;

  // Insert new ownership data in batches
  const batchSize = 100;
  for (let i = 0; i < ownership.length; i += batchSize) {
    const batch = ownership.slice(i, i + batchSize);
    const values = batch
      .map(
        (o) =>
          `(${snapshot.id}, '${o.tokenId}', '${o.owner}', '${o.leaf}', ARRAY[${o.proof.map((p) => `'${p}'`).join(",")}]::TEXT[])`
      )
      .join(",");

    if (values) {
      await sql.query(
        `INSERT INTO ownership (snapshot_id, token_id, owner, leaf, proof) VALUES ${values}`
      );
    }
  }

  return snapshot;
}

export async function getAllSnapshots(network?: Network): Promise<StoredSnapshot[]> {
  if (network) {
    const result = await sql<StoredSnapshot>`
      SELECT * FROM snapshots
      WHERE network = ${network}
      ORDER BY updated_at DESC
    `;
    return result.rows;
  }
  const result = await sql<StoredSnapshot>`
    SELECT * FROM snapshots
    ORDER BY updated_at DESC
  `;
  return result.rows;
}

export async function deleteSnapshot(contractAddress: string, network: Network = "testnet"): Promise<void> {
  await sql`
    DELETE FROM snapshots
    WHERE contract_address = ${contractAddress.toLowerCase()}
    AND network = ${network}
  `;
}
