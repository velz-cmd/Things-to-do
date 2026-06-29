import "server-only";

import { PrismaClient } from "@prisma/client";
import { getDatabaseUrl } from "@/lib/db/connection";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const connectionString = getDatabaseUrl();
if (connectionString) {
  process.env.DATABASE_URL = connectionString;
}

/**
 * Singleton Prisma client — required on Vercel/serverless to avoid exhausting
 * Supabase session pool (default pool_size ~15).
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

globalForPrisma.prisma = prisma;

export async function ensureStats() {
  await prisma.stats.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
}
