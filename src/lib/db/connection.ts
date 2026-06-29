/** Normalize Supabase pooler URL for Prisma serverless (transaction mode). */
export function getDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) return undefined;

  try {
    const url = new URL(raw);
    if (!url.searchParams.has("pgbouncer")) {
      url.searchParams.set("pgbouncer", "true");
    }
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "1");
    }
    return url.toString();
  } catch {
    return raw;
  }
}

export function isDbPoolExhaustedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("max clients reached") ||
    message.includes("EMAXCONNSESSION") ||
    message.includes("Too many connections") ||
    message.includes("connection slots")
  );
}
