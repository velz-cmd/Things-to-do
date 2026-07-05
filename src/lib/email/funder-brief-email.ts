import { deliverAuthEmail } from "@/lib/email/deliver";
import type { FunderIntelBrief } from "@/lib/capital/funder-intel-brief";

function appOrigin() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

function renderBriefHtml(brief: FunderIntelBrief): string {
  const origin = appOrigin();
  const contributors =
    brief.topContributors.length > 0
      ? `<ul style="margin: 12px 0; padding-left: 18px; color: #c8d4e0;">
${brief.topContributors
  .map(
    (c) =>
      `<li><strong>${c.label}</strong> — $${c.amountUsd.toFixed(2)} · ${c.status.replace(/_/g, " ")}</li>`,
  )
  .join("\n")}
</ul>`
      : `<p style="color: #8b9aab; font-size: 13px;">No authorizations in queue yet — sensors will populate this as value is recognized.</p>`;

  const links = brief.evidenceLinks
    .map(
      (l) =>
        `<li><a href="${origin}${l.href}" style="color: #6ee7b7;">${l.label}</a></li>`,
    )
    .join("\n");

  return `
    <div style="font-family: sans-serif; max-width: 560px; color: #e8eef4;">
      <p style="color: #6ee7b7; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em;">
        RESOLVE · ${brief.tierLabel}
      </p>
      <h1 style="font-size: 20px; margin: 8px 0 4px;">${brief.headline}</h1>
      <p style="color: #8b9aab; font-size: 14px; line-height: 1.5;">${brief.sourcedHook}</p>
      <p style="margin: 16px 0 8px; font-size: 13px; color: #c8d4e0;"><strong>${brief.peopleLine}</strong></p>
      <h2 style="font-size: 14px; margin: 20px 0 8px;">Pool facts (ledger)</h2>
      <ul style="margin: 0; padding-left: 18px; color: #c8d4e0; font-size: 13px; line-height: 1.6;">
        ${brief.poolFacts.map((f) => `<li>${f}</li>`).join("\n")}
      </ul>
      ${
        brief.checkpointLine
          ? `<p style="margin: 16px 0 8px; font-size: 13px; color: #a5b4fc;">${brief.checkpointLine}</p>`
          : ""
      }
      <h2 style="font-size: 14px; margin: 20px 0 8px;">Top contributors in queue</h2>
      ${contributors}
      <h2 style="font-size: 14px; margin: 20px 0 8px;">Evidence links</h2>
      <ul style="margin: 0; padding-left: 18px; font-size: 13px;">${links}</ul>
      <hr style="border: none; border-top: 1px solid #1e2d3a; margin: 24px 0;" />
      <p style="color: #8b9aab; font-size: 12px; line-height: 1.5;">
        This brief is sourced from RESOLVE authorization ledger and pool balances — not generic research.
        Creators receive USDC when pools settle; you receive tiered intelligence by stake size.
      </p>
    </div>
  `;
}

export async function sendFunderIntelBriefEmail(input: {
  to: string;
  brief: FunderIntelBrief;
}): Promise<{ ok: boolean; provider?: string; error?: string }> {
  const html = renderBriefHtml(input.brief);
  const result = await deliverAuthEmail({
    to: input.to,
    subject: input.brief.subject,
    html,
  });
  if (!result.ok) {
    return { ok: false, error: result.message };
  }
  return { ok: true, provider: result.provider };
}
