import { createHash } from "crypto";
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";

export const ALLOWED_EVIDENCE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "application/zip",
  "application/x-zip-compressed",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024; // 25 MB

export function uploadsRoot() {
  return path.join(process.cwd(), ".resolve", "uploads");
}

export function hashBuffer(buf: Buffer): string {
  return `0x${createHash("sha256").update(buf).digest("hex")}`;
}

export async function storeEvidenceFile(
  userId: string,
  fileName: string,
  fileType: string,
  buffer: Buffer
): Promise<{ storagePath: string; hash: string }> {
  const dir = path.join(uploadsRoot(), userId);
  await mkdir(dir, { recursive: true });
  const hash = hashBuffer(buffer);
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const storagePath = path.join(dir, `${Date.now()}-${safeName}`);
  await writeFile(storagePath, buffer);
  return { storagePath, hash };
}

export async function readEvidenceFile(storagePath: string): Promise<Buffer> {
  return readFile(storagePath);
}

export async function deleteEvidenceFile(storagePath: string) {
  try {
    await unlink(storagePath);
  } catch {
    /* already gone */
  }
}

export async function extractTextFromFile(
  fileType: string,
  buffer: Buffer
): Promise<string | undefined> {
  if (fileType === "text/plain" || fileType === "text/csv") {
    return buffer.toString("utf8").slice(0, 8000);
  }
  return undefined;
}

export function evidenceTypeLabel(fileType: string): string {
  if (fileType.startsWith("image/")) return "screenshot";
  if (fileType === "application/pdf") return "pdf";
  if (fileType.startsWith("video/")) return "video";
  if (fileType.includes("zip")) return "archive";
  return "document";
}
