export type DatabaseUrlDiagnostics = {
  configured: boolean;
  /** Hostname only — never includes credentials. */
  host: string | null;
  port: number | null;
  database: string | null;
  isSupabasePooler: boolean;
  /** Port 6543 on Supabase pooler = transaction mode (correct for Vercel). */
  isTransactionPooler: boolean;
  /** Port 5432 on pooler.supabase.com = session mode (causes EMAXCONNSESSION on serverless). */
  isSessionPooler: boolean;
  /** Direct db.*.supabase.co connection — avoid on Vercel. */
  isDirectSupabase: boolean;
  rawHasPgbouncerParam: boolean;
  rawHasConnectionLimit: boolean;
  normalizedHasPgbouncerParam: boolean;
  normalizedHasConnectionLimit: boolean;
  prismaReady: boolean;
  /** True when runtime rewrote session pooler port 5432 → transaction 6543. */
  portRewritten: boolean;
  normalizedPort: number | null;
  /** Which env var supplied the URL (value never exposed). */
  envSource: string | null;
};

/** Vercel / Supabase integrations may use different key names. */
export const DATABASE_ENV_KEYS = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "SUPABASE_DATABASE_URL",
] as const;

export function listPresentDatabaseEnvKeys(): string[] {
  return DATABASE_ENV_KEYS.filter((key) => Boolean(process.env[key]?.trim()));
}

export function resolveRawDatabaseUrl(): { key: string; url: string } | null {
  for (const key of DATABASE_ENV_KEYS) {
    const url = process.env[key]?.trim();
    if (url) return { key, url };
  }
  return null;
}

const PRISMA_POOL_PARAMS = {
  pgbouncer: "true",
  connection_limit: "1",
} as const;

/** Append Prisma pool params without parsing credentials (safe for special chars in password). */
export function appendDatabaseQueryParams(
  raw: string,
  params: Record<string, string>,
): string {
  const trimmed = raw.trim();
  const question = trimmed.indexOf("?");
  const base = question === -1 ? trimmed : trimmed.slice(0, question);
  const query = question === -1 ? "" : trimmed.slice(question + 1);
  const search = new URLSearchParams(query);

  for (const [key, value] of Object.entries(params)) {
    if (!search.has(key)) search.set(key, value);
  }

  const next = search.toString();
  return next ? `${base}?${next}` : base;
}

function parsePostgresEndpoint(raw: string): Pick<
  DatabaseUrlDiagnostics,
  "host" | "port" | "database"
> {
  const withoutScheme = raw.replace(/^postgres(ql)?:\/\//i, "");
  const at = withoutScheme.lastIndexOf("@");
  if (at === -1) return { host: null, port: null, database: null };

  const authority = withoutScheme.slice(at + 1);
  const slash = authority.indexOf("/");
  const hostPort = slash === -1 ? authority : authority.slice(0, slash);
  const database =
    slash === -1 ? null : authority.slice(slash + 1).split("?")[0] || null;

  const colon = hostPort.lastIndexOf(":");
  if (colon === -1) {
    return { host: hostPort || null, port: null, database };
  }

  const host = hostPort.slice(0, colon) || null;
  const port = Number(hostPort.slice(colon + 1));
  return {
    host,
    port: Number.isFinite(port) ? port : null,
    database,
  };
}

/** Supabase session pooler (5432) → transaction pooler (6543) for Vercel/serverless. */
export function rewriteSupabasePoolerPort(raw: string): string {
  const trimmed = raw.trim();
  const withoutScheme = trimmed.replace(/^postgres(ql)?:\/\//i, "");
  const at = withoutScheme.lastIndexOf("@");
  if (at === -1) return trimmed;

  const prefix = trimmed.slice(0, trimmed.length - withoutScheme.length + at + 1);
  const suffix = withoutScheme.slice(at + 1);
  if (!/pooler\.supabase\.com:5432/i.test(suffix)) return trimmed;

  return prefix + suffix.replace(/pooler\.supabase\.com:5432/i, "pooler.supabase.com:6543");
}

export function analyzeDatabaseUrl(
  rawInput?: string,
  envSource: string | null = null,
): DatabaseUrlDiagnostics {
  const raw = rawInput?.trim() ?? "";
  if (!raw) {
    return {
      configured: false,
      host: null,
      port: null,
      database: null,
      isSupabasePooler: false,
      isTransactionPooler: false,
      isSessionPooler: false,
      isDirectSupabase: false,
      rawHasPgbouncerParam: false,
      rawHasConnectionLimit: false,
      normalizedHasPgbouncerParam: false,
      normalizedHasConnectionLimit: false,
      prismaReady: false,
      portRewritten: false,
      normalizedPort: null,
      envSource: null,
    };
  }

  const { host, port, database } = parsePostgresEndpoint(raw);
  const rewritten = rewriteSupabasePoolerPort(raw);
  const normalized = appendDatabaseQueryParams(rewritten, { ...PRISMA_POOL_PARAMS });
  const normalizedEndpoint = parsePostgresEndpoint(normalized);
  const portRewritten = rewritten !== raw;

  const hostLower = host?.toLowerCase() ?? "";
  const isSupabasePooler = hostLower.includes("pooler.supabase.com");
  const isDirectSupabase = hostLower.includes(".supabase.co") && !isSupabasePooler;
  const isTransactionPooler = Boolean(
    normalizedEndpoint.host?.toLowerCase().includes("pooler.supabase.com") &&
      normalizedEndpoint.port === 6543,
  );
  const isSessionPooler = isSupabasePooler && port === 5432 && !portRewritten;

  const rawHasPgbouncerParam = /(?:^|[?&])pgbouncer=true(?:&|$)/i.test(raw);
  const rawHasConnectionLimit = /(?:^|[?&])connection_limit=1(?:&|$)/i.test(raw);
  const normalizedHasPgbouncerParam = /(?:^|[?&])pgbouncer=true(?:&|$)/i.test(normalized);
  const normalizedHasConnectionLimit = /(?:^|[?&])connection_limit=1(?:&|$)/i.test(
    normalized,
  );

  const prismaReady =
    isTransactionPooler && normalizedHasPgbouncerParam && normalizedHasConnectionLimit;

  return {
    configured: true,
    host,
    port,
    database,
    isSupabasePooler,
    isTransactionPooler,
    isSessionPooler,
    isDirectSupabase,
    rawHasPgbouncerParam,
    rawHasConnectionLimit,
    normalizedHasPgbouncerParam,
    normalizedHasConnectionLimit,
    prismaReady,
    portRewritten,
    normalizedPort: normalizedEndpoint.port,
    envSource,
  };
}

/** Normalize Supabase pooler URL for Prisma serverless (transaction mode). */
export function getDatabaseUrl(): string | undefined {
  const resolved = resolveRawDatabaseUrl();
  if (!resolved) return undefined;
  const rewritten = rewriteSupabasePoolerPort(resolved.url);
  return appendDatabaseQueryParams(rewritten, { ...PRISMA_POOL_PARAMS });
}

export function getDatabaseDiagnostics(): DatabaseUrlDiagnostics {
  const resolved = resolveRawDatabaseUrl();
  return analyzeDatabaseUrl(resolved?.url, resolved?.key ?? null);
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
