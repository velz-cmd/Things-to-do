import "server-only";

import pg from "pg";

/** Session/direct Postgres URL — required for DDL on Supabase (not transaction pooler). */
export function getDirectDatabaseUrl(): string | undefined {
  const direct = process.env.DIRECT_URL?.trim();
  if (direct) return direct;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl && /\.supabase\.co:5432/i.test(databaseUrl)) {
    return databaseUrl;
  }

  return undefined;
}

export async function runDdlOnDirectConnection(sql: string): Promise<boolean> {
  const connectionString = getDirectDatabaseUrl();
  if (!connectionString) return false;

  const client = new pg.Client({
    connectionString,
    ssl: connectionString.includes("supabase.co")
      ? { rejectUnauthorized: false }
      : undefined,
  });

  try {
    await client.connect();
    await client.query(sql);
    return true;
  } catch (e) {
    console.error("[db] direct DDL failed:", e);
    return false;
  } finally {
    await client.end().catch(() => {
      /* ignore */
    });
  }
}
