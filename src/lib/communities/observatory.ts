import { prisma } from "@/lib/db";
import { getAuthorizationSummary } from "@/lib/authorization/ledger";
import { getTreasurySnapshot } from "@/lib/treasury/engine";
import { getNavidromeSyncStatus } from "@/lib/connectors/navidrome-sync";
import type { ProgramRecord } from "./types";

export type ObservatoryAlert = {
  id: string;
  severity: "critical" | "watch" | "positive";
  title: string;
  detail: string;
  at: string;
};

function parseRepos(raw: string | null | undefined): Array<{
  fullName: string;
  maintainerCount?: number;
  fundingGapUsd?: number;
}> {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Array<{
      fullName: string;
      maintainerCount?: number;
      fundingGapUsd?: number;
    }>;
  } catch {
    return [];
  }
}

/** Background alerts for a community — not chat. */
export async function buildCommunityObservatory(input: {
  userId: string;
  communitySlug: string;
  ecosystemId: string | null;
  programs: ProgramRecord[];
  kind: string;
}): Promise<ObservatoryAlert[]> {
  const alerts: ObservatoryAlert[] = [];
  const now = new Date().toISOString();

  if (input.ecosystemId) {
    const eco = await prisma.resolveEcosystem.findFirst({
      where: { id: input.ecosystemId, userId: input.userId },
    });
    if (eco) {
      for (const repo of parseRepos(eco.reposJson)) {
        const maint = repo.maintainerCount ?? 0;
        if (maint > 0 && maint <= 2) {
          alerts.push({
            id: `maint-${repo.fullName}`,
            severity: maint === 1 ? "critical" : "watch",
            title: `${maint} maintainer${maint === 1 ? "" : "s"} left`,
            detail: `${repo.fullName} — elevated bus-factor risk`,
            at: now,
          });
        }
        if ((repo.fundingGapUsd ?? 0) > 50_000) {
          alerts.push({
            id: `gap-${repo.fullName}`,
            severity: "watch",
            title: `Funding gap · ${repo.fullName}`,
            detail: `$${Math.round((repo.fundingGapUsd ?? 0) / 1000)}k unfunded maintenance demand`,
            at: now,
          });
        }
      }
    }
  }

  const missionIds = input.programs.map((p) => p.missionId).filter(Boolean) as string[];
  let authorizedUsd = 0;
  for (const missionId of missionIds) {
    const s = await getAuthorizationSummary({ missionId });
    authorizedUsd += s.authorizedUsd + s.pendingFundingUsd;
  }

  const treasury = await getTreasurySnapshot().catch(() => null);
  if (treasury && authorizedUsd > treasury.availableUsd && authorizedUsd > 0) {
    alerts.push({
      id: "treasury-gap",
      severity: "critical",
      title: "Treasury underfunded for obligations",
      detail: `$${authorizedUsd.toFixed(2)} authorized · $${treasury.availableUsd.toFixed(2)} available`,
      at: now,
    });
  }

  if (input.kind === "music" || input.communitySlug === "navidrome") {
    const nav = await getNavidromeSyncStatus().catch(() => null);
    if (!nav?.cursor) {
      alerts.push({
        id: "scrobble-bridge",
        severity: "watch",
        title: "Scrobble bridge not synced",
        detail: "Run scripts/navidrome-bridge.ts on your Navidrome host to ingest plays",
        at: now,
      });
    } else {
      const last = new Date(nav.cursor.lastSubmissionTime).getTime();
      const hoursAgo = (Date.now() - last) / 3_600_000;
      if (hoursAgo > 48) {
        alerts.push({
          id: "scrobble-stale",
          severity: "watch",
          title: "No recent scrobbles",
          detail: `Last sync ${Math.round(hoursAgo)}h ago — check bridge cron`,
          at: now,
        });
      } else if (authorizedUsd > 0) {
        alerts.push({
          id: "scrobble-live",
          severity: "positive",
          title: "Plays flowing to authorization ledger",
          detail: `$${authorizedUsd.toFixed(2)} owed from verified listens`,
          at: now,
        });
      }
    }
  }

  const severityOrder = { critical: 0, watch: 1, positive: 2 };
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
