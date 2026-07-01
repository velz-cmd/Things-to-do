import { prisma } from "@/lib/db";
import { isMissingTableError, isPrismaUnavailableError } from "@/lib/db/prisma-errors";
import { EARN_ELIGIBILITY_RULES, type EarnEligibilityRule } from "@/lib/earn/eligibility-copy";
import { resolveClaimIdentities } from "@/lib/identity/claim-identities";
import {
  userJellyfinConfigured,
  userListenBrainzConfigured,
} from "@/lib/profile/user-connections";
import { normalizeGithubLogin } from "@/lib/identity/github-login";
import type { User } from "@prisma/client";

export type UserWorkStream = {
  id: EarnEligibilityRule["id"];
  label: string;
  connected: boolean;
  displayValue?: string;
  activityCount: number;
  activityLabel: string;
  meetsEligibility: boolean;
  threshold: string;
  detail: string;
  recentItems: Array<{
    label: string;
    amountUsd?: number;
    status?: string;
    at?: string;
  }>;
};

const OSS_EVENTS = /merge|contribution|docs|security|pr/i;
const MUSIC_EVENTS = /play|listen|scrobble|royalt/i;
const VIDEO_EVENTS = /view|watch|jellyfin|video/i;
const RESEARCH_EVENTS = /citation|openalex|research/i;

function domainForEventType(eventType: string): UserWorkStream["id"] | null {
  const t = eventType.toLowerCase();
  if (OSS_EVENTS.test(t)) return "oss";
  if (MUSIC_EVENTS.test(t)) return "music";
  if (VIDEO_EVENTS.test(t)) return "video";
  if (RESEARCH_EVENTS.test(t)) return "research";
  return null;
}

function eligibilityMet(id: UserWorkStream["id"], count: number, connected: boolean): boolean {
  if (!connected) return false;
  if (id === "oss") return count >= 5;
  if (id === "music") return count >= 1000;
  if (id === "video") return count >= 500;
  if (id === "research") return count >= 10;
  return false;
}

function activityLabel(id: UserWorkStream["id"], count: number): string {
  if (count === 0) return "Synced — waiting for recognized events";
  if (id === "oss") return `${count} contribution event${count === 1 ? "" : "s"} on ledger`;
  if (id === "music") return `${count.toLocaleString()} play event${count === 1 ? "" : "s"} recognized`;
  if (id === "video") return `${count.toLocaleString()} watch event${count === 1 ? "" : "s"} recognized`;
  return `${count} citation event${count === 1 ? "" : "s"} recognized`;
}

/** Reads connected profile identities + ledger/timeline — surfaces work that maps to earn eligibility. */
export async function buildUserEligibleWork(input: {
  userId: string;
  profile: Pick<
    User,
    | "githubUsername"
    | "listenbrainzUsername"
    | "jellyfinUrl"
    | "jellyfinUsername"
    | "jellyfinAccessToken"
    | "jellyfinPassword"
    | "walletAddress"
    | "scanWalletAddress"
  >;
}): Promise<UserWorkStream[]> {
  const github = normalizeGithubLogin(input.profile.githubUsername);
  const listenbrainz = userListenBrainzConfigured(input.profile);
  const jellyfin = userJellyfinConfigured(input.profile);

  const ruleById = Object.fromEntries(
    EARN_ELIGIBILITY_RULES.map((r) => [r.id, r]),
  ) as Record<EarnEligibilityRule["id"], EarnEligibilityRule>;

  const streams: UserWorkStream[] = [
    {
      id: "oss",
      label: ruleById.oss.label,
      connected: Boolean(github),
      displayValue: github ? `@${github}` : undefined,
      activityCount: 0,
      activityLabel: "Connect GitHub on Profile",
      meetsEligibility: false,
      threshold: ruleById.oss.threshold,
      detail: ruleById.oss.detail,
      recentItems: [],
    },
    {
      id: "music",
      label: ruleById.music.label,
      connected: listenbrainz,
      displayValue: input.profile.listenbrainzUsername
        ? `@${input.profile.listenbrainzUsername}`
        : undefined,
      activityCount: 0,
      activityLabel: "Connect ListenBrainz on Profile",
      meetsEligibility: false,
      threshold: ruleById.music.threshold,
      detail: ruleById.music.detail,
      recentItems: [],
    },
    {
      id: "video",
      label: ruleById.video.label,
      connected: jellyfin,
      displayValue: input.profile.jellyfinUsername
        ? `@${input.profile.jellyfinUsername}`
        : undefined,
      activityCount: 0,
      activityLabel: "Connect Jellyfin on Profile",
      meetsEligibility: false,
      threshold: ruleById.video.threshold,
      detail: ruleById.video.detail,
      recentItems: [],
    },
    {
      id: "research",
      label: ruleById.research.label,
      connected: Boolean(github),
      displayValue: github ? `@${github} · OpenAlex` : undefined,
      activityCount: 0,
      activityLabel: "Connect GitHub for research attribution",
      meetsEligibility: false,
      threshold: ruleById.research.threshold,
      detail: ruleById.research.detail,
      recentItems: [],
    },
  ];

  if (!process.env.DATABASE_URL) {
    return streams.map((s) =>
      s.connected
        ? { ...s, activityLabel: "Source connected — sync runs in background" }
        : s,
    );
  }

  try {
    const identities = await resolveClaimIdentities({ profile: input.profile });
    if (!identities.length) return streams;

    const auths = await prisma.paymentAuthorization.findMany({
      where: {
        OR: identities.map((i) => ({
          payeeKeyType: i.payeeKeyType,
          payeeKey: i.payeeKey.toLowerCase(),
        })),
      },
      orderBy: { createdAt: "desc" },
      take: 120,
      select: {
        eventType: true,
        amountUsd: true,
        status: true,
        contextLabel: true,
        createdAt: true,
      },
    });

    const counts: Record<UserWorkStream["id"], number> = {
      oss: 0,
      music: 0,
      video: 0,
      research: 0,
    };
    const recent: Record<UserWorkStream["id"], UserWorkStream["recentItems"]> = {
      oss: [],
      music: [],
      video: [],
      research: [],
    };

    for (const row of auths) {
      const domain = domainForEventType(row.eventType);
      if (!domain) continue;
      counts[domain] += 1;
      if (recent[domain].length < 4) {
        recent[domain].push({
          label: row.contextLabel ?? row.eventType.replace(/_/g, " "),
          amountUsd: row.amountUsd,
          status: row.status,
          at: row.createdAt.toISOString(),
        });
      }
    }

    const timeline = await prisma.resolveTimelineEvent.findMany({
      where: { userId: input.userId },
      orderBy: { createdAt: "desc" },
      take: 24,
      select: { eventType: true, title: true, detail: true, createdAt: true },
    });

    for (const row of timeline) {
      const domain = domainForEventType(row.eventType);
      if (!domain) continue;
      if (recent[domain].length < 4) {
        recent[domain].push({
          label: row.title,
          at: row.createdAt.toISOString(),
        });
      }
    }

    return streams.map((stream) => {
      const count = counts[stream.id];
      const connected = stream.connected;
      const meets = eligibilityMet(stream.id, count, connected);
      return {
        ...stream,
        activityCount: count,
        activityLabel: connected ? activityLabel(stream.id, count) : stream.activityLabel,
        meetsEligibility: meets,
        recentItems: recent[stream.id],
      };
    });
  } catch (e) {
    if (!isMissingTableError(e) && !isPrismaUnavailableError(e)) {
      console.warn("[user-eligible-work]", e);
    }
    return streams.map((s) =>
      s.connected ? { ...s, activityLabel: "Connected — ledger sync in progress" } : s,
    );
  }
}
