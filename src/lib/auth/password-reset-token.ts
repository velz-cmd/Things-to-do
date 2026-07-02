import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { ensurePasswordResetSchema } from "@/lib/db/ensure-password-reset-schema";
import { isMissingTableError } from "@/lib/db/prisma-errors";

const RESET_TTL_MS = 60 * 60 * 1000;

export class PasswordResetStorageError extends Error {
  constructor(message = "Password reset storage unavailable") {
    super(message);
    this.name = "PasswordResetStorageError";
  }
}

export function hashResetToken(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

export function generateResetToken(): { plain: string; hash: string } {
  const plain = randomBytes(32).toString("base64url");
  return { plain, hash: hashResetToken(plain) };
}

async function withResetTable<T>(fn: () => Promise<T>): Promise<T> {
  const ready = await ensurePasswordResetSchema();
  if (!ready) {
    throw new PasswordResetStorageError();
  }
  try {
    return await fn();
  } catch (e) {
    if (isMissingTableError(e)) {
      throw new PasswordResetStorageError();
    }
    throw e;
  }
}

export async function invalidateActiveResetTokens(email: string) {
  await withResetTable(() =>
    prisma.passwordResetToken.updateMany({
      where: {
        email: email.trim().toLowerCase(),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    }),
  );
}

export async function createPasswordResetToken(input: {
  userId: string;
  email: string;
  ttlMs?: number;
}): Promise<{ plain: string; expiresAt: Date }> {
  const email = input.email.trim().toLowerCase();
  await invalidateActiveResetTokens(email);

  const { plain, hash } = generateResetToken();
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? RESET_TTL_MS));

  await withResetTable(() =>
    prisma.passwordResetToken.create({
      data: {
        userId: input.userId,
        email,
        tokenHash: hash,
        expiresAt,
      },
    }),
  );

  return { plain, expiresAt };
}

export async function findValidResetToken(plain: string) {
  const ready = await ensurePasswordResetSchema();
  if (!ready) return null;

  try {
    const hash = hashResetToken(plain.trim());
    const row = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hash },
    });

    if (!row || row.usedAt || row.expiresAt <= new Date()) {
      return null;
    }

    return row;
  } catch (e) {
    if (isMissingTableError(e)) return null;
    throw e;
  }
}

export async function markResetTokenUsed(id: string) {
  await withResetTable(() =>
    prisma.passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    }),
  );
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.length <= 2 ? local[0] ?? "*" : local.slice(0, 2);
  return `${visible}***@${domain}`;
}
