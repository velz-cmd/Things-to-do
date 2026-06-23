import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import type { BrowserProof, BrowserProofType } from "@/lib/browser/browser-types";

export function hashContent(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function proofDir(taskId: string) {
  return path.join(process.cwd(), ".resolve", "browser-proofs", taskId);
}

export async function saveProofArtifact(input: {
  taskId: string;
  type: BrowserProofType;
  title: string;
  buffer?: Buffer;
  text?: string;
}): Promise<BrowserProof> {
  const hash = hashContent(input.buffer ?? input.text ?? input.title);
  const id = randomUUID();
  let artifactPath: string | undefined;
  let artifactData: string | undefined;

  if (input.buffer) {
    const dir = proofDir(input.taskId);
    await mkdir(dir, { recursive: true });
    const ext = input.type === "trace" ? "zip" : "png";
    artifactPath = path.join(dir, `${id}.${ext}`);
    await writeFile(artifactPath, input.buffer);
    artifactData = input.buffer.toString("base64");
  }

  await prisma.browserProof.create({
    data: {
      id,
      taskId: input.taskId,
      type: input.type,
      title: input.title,
      path: artifactPath ?? null,
      text: input.text ?? null,
      artifactData: artifactData ?? null,
      hash,
    },
  });

  return {
    id,
    taskId: input.taskId,
    type: input.type,
    title: input.title,
    path: artifactPath,
    text: input.text,
    hash,
    createdAt: new Date().toISOString(),
  };
}

export async function loadProofArtifact(
  proofId: string
): Promise<{ mime: string; buffer: Buffer } | null> {
  const row = await prisma.browserProof.findUnique({ where: { id: proofId } });
  if (!row) return null;

  if (row.artifactData) {
    const buffer = Buffer.from(row.artifactData, "base64");
    const mime =
      row.type === "trace"
        ? "application/zip"
        : row.type === "download"
          ? "application/pdf"
          : "image/png";
    return { mime, buffer };
  }

  if (row.path) {
    try {
      const buffer = await readFile(row.path);
      const mime = row.type === "trace" ? "application/zip" : "image/png";
      return { mime, buffer };
    } catch {
      return null;
    }
  }

  return null;
}

export async function attachBrowserProofToTask(input: {
  taskId: string;
  proof: BrowserProof;
  confirmationId?: string;
}) {
  const payload = {
    confirmationId: input.confirmationId,
    browserProofId: input.proof.id,
    hash: input.proof.hash,
    extractedText: input.proof.text,
  };

  await prisma.proof.create({
    data: {
      taskId: input.taskId,
      type: "portal_status_cancelled",
      source: "browser://resolve-executor",
      payload: JSON.stringify(payload),
      contentHash: input.proof.hash,
      artifactUrl: `/api/browser/proof/${input.proof.id}`,
      verified: false,
    },
  });
}
