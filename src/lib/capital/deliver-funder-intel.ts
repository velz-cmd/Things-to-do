import { prisma } from "@/lib/db";
import { buildFunderIntelBrief } from "@/lib/capital/funder-intel-brief";
import { sendFunderIntelBriefEmail } from "@/lib/email/funder-brief-email";

/** Post-fund + checkpoint milestone — email tiered evidence brief to funder. */
export async function deliverFunderIntelBrief(input: {
  userId: string;
  programId: string;
  stakeUsd: number;
  trigger: "fund" | "checkpoint";
  checkpointThresholdUsd?: number;
}): Promise<{ ok: boolean; skipped?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true, displayName: true },
  });
  if (!user?.email) {
    return { ok: false, skipped: "no_email" };
  }

  const brief = await buildFunderIntelBrief({
    programId: input.programId,
    userId: input.userId,
    stakeUsd: input.stakeUsd,
  });
  if (!brief) {
    return { ok: false, skipped: "no_brief" };
  }

  if (input.trigger === "checkpoint" && input.checkpointThresholdUsd != null) {
    brief.headline = `Checkpoint $${input.checkpointThresholdUsd.toFixed(0)} crossed — updated ${brief.tierLabel.toLowerCase()}`;
    brief.subject = `Checkpoint brief · ${brief.programName}`;
  }

  const sent = await sendFunderIntelBriefEmail({ to: user.email, brief });
  if (!sent.ok) {
    console.warn("[funder-intel] email failed:", sent.error);
    return { ok: false, skipped: sent.error ?? "email_failed" };
  }

  console.info(
    `[funder-intel] ${brief.tier} brief → ${user.email} program=${input.programId} $${input.stakeUsd}`,
  );
  return { ok: true };
}
