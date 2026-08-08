import "server-only";

import { prisma } from "@/lib/db";
import { loadStoredOssOpportunities } from "@/lib/github/oss-scan-store";
import { normalizeGithubAcceptedWork } from "@/lib/discover/marketplace/read-model";

export type PayableVerifiedWork = {
  subjectId: string;
  title: string;
  repository: string;
  sourceUrl: string;
  actor: string;
  recipientUserId: string;
  evidenceIds: string[];
};

/**
 * Resolve a payable work record from persisted GitHub evidence. The browser
 * supplies only an opaque subject id. Recipient, attribution, and source proof
 * are checked again on the server before any transfer can start.
 */
export async function resolvePayableVerifiedWork(
  subjectId: string,
  recipientUserId: string,
): Promise<PayableVerifiedWork | null> {
  const normalizedSubject = subjectId.trim();
  if (!normalizedSubject) return null;

  const [stored, recipient] = await Promise.all([
    loadStoredOssOpportunities(),
    prisma.user.findUnique({
      where: { id: recipientUserId },
      select: { id: true, githubUsername: true },
    }),
  ]);
  const work = normalizeGithubAcceptedWork(stored.opportunities).find(
    (item) => item.source.type === "github_evidence" && item.source.id === normalizedSubject,
  );
  const githubUsername = recipient?.githubUsername?.trim().replace(/^@/, "");
  if (
    !work ||
    !recipient ||
    !githubUsername ||
    githubUsername.toLowerCase() !== work.creator.name.trim().replace(/^@/, "").toLowerCase() ||
    !work.repository ||
    !work.sourceUrl
  ) return null;

  return {
    subjectId: work.source.id,
    title: work.title,
    repository: work.repository,
    sourceUrl: work.sourceUrl,
    actor: work.creator.name,
    recipientUserId: recipient.id,
    evidenceIds: [work.source.id],
  };
}
