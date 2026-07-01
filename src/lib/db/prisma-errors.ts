import { Prisma } from "@prisma/client";

/** True when Postgres/Prisma reports a missing table or column (schema not migrated yet). */
export function isMissingTableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021" || error.code === "P2022";
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    /does not exist/i.test(message) ||
    /relation .* does not exist/i.test(message) ||
    /column .* does not exist/i.test(message)
  );
}
