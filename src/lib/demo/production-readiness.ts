import { prisma } from "@/lib/db";
import { isDeputyDemoMode } from "@/lib/config/demo-mode";
import { pingNavidrome, isNavidromeConfigured } from "@/lib/integrations/navidrome";
import { getArcReadiness } from "@/lib/treasury/arc-readiness";
import {
  fetchSupabaseAuthSettings,
  isSupabaseExternalProviderEnabled,
} from "@/lib/supabase/auth-settings";
import { getNavidromeSyncStatus } from "@/lib/connectors/navidrome-sync";
import { countProductionRegistryArtists } from "@/lib/registry/production-artists";

export type ReadinessItem = {
  id: string;
  label: string;
  status: "ready" | "partial" | "blocked";
  detail: string;
  action?: string;
  href?: string;
};

export type ProductionDemoReadiness = {
  ok: boolean;
  score: number;
  total: number;
  liveUrl: string;
  demoMode: boolean;
  items: ReadinessItem[];
  paths: {
    music: string[];
    bounty: string[];
    claim: string[];
  };
};

function item(
  id: string,
  label: string,
  status: ReadinessItem["status"],
  detail: string,
  action?: string,
  href?: string,
): ReadinessItem {
  return { id, label, status, detail, action, href };
}

/** Honest checklist for Lepton / external-user production demo. */
export async function getProductionDemoReadiness(): Promise<ProductionDemoReadiness> {
  const liveUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "https://resolve-task.vercel.app";

  const demoMode = isDeputyDemoMode();
  const musicbrainzOAuth =
    Boolean(process.env.MUSICBRAINZ_CLIENT_ID?.trim()) &&
    Boolean(process.env.MUSICBRAINZ_CLIENT_SECRET?.trim());
  const listenbrainzReady = musicbrainzOAuth;
  const openAlexReady =
    Boolean(process.env.OPENALEX_API_KEY?.trim()) ||
    Boolean(process.env.OPENALEX_EMAIL?.trim()) ||
    Boolean(process.env.RESOLVE_CONTACT_EMAIL?.trim());
  const navidromeEnv = isNavidromeConfigured();
  const navidromeSecret = Boolean(process.env.NAVIDROME_SYNC_SECRET?.trim());
  const cronSecret = Boolean(
    process.env.CRON_SECRET?.trim() || process.env.CLAIM_TOKEN_SECRET?.trim(),
  );

  const [arc, navidromePing, navidromeCursor, registryCount, externalUsers, githubOAuth] =
    await Promise.all([
      getArcReadiness(0.01),
      navidromeEnv ? pingNavidrome() : Promise.resolve({ ok: false, message: "Not configured" }),
      getNavidromeSyncStatus().catch(() => null),
      countProductionRegistryArtists().catch(() => 0),
      prisma.user
        .count({
          where: {
            OR: [
              { listenbrainzUsername: { not: null } },
              { githubUsername: { not: null } },
            ],
          },
        })
        .catch(() => 0),
      (async () => {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
        const anon =
          process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !anon) return false;
        const settings = await fetchSupabaseAuthSettings(url, anon);
        return isSupabaseExternalProviderEnabled(settings?.external?.github);
      })(),
    ]);

  const treasuryFunded = (arc.balanceUsd ?? 0) >= 0.01;
  const onChainReady = arc.canDistributeOnChain;
  const scrobbleIngress =
    navidromeCursor?.cursor != null ||
    navidromePing.ok ||
    Boolean(process.env.NAVIDROME_PROGRAM_MISSION_ID?.trim());

  const items: ReadinessItem[] = [
    demoMode
      ? item(
          "demo-mode",
          "Production honesty",
          "blocked",
          "DEPUTY_DEMO_MODE=true — card credits and fake Gmail receipts are active",
          "Set DEPUTY_DEMO_MODE=false on Vercel Production, then redeploy",
          "https://vercel.com/docs/projects/environment-variables",
        )
      : item(
          "demo-mode",
          "Production honesty",
          "ready",
          "Demo mode off — no fake card credits or synthetic Gmail receipts",
        ),

    listenbrainzReady
      ? item(
          "listenbrainz",
          "ListenBrainz OAuth",
          "ready",
          "MusicBrainz OAuth configured — external users can connect ListenBrainz on Profile",
          "Profile → Connect ListenBrainz",
          "/profile",
        )
      : item(
          "listenbrainz",
          "ListenBrainz OAuth",
          "blocked",
          "MUSICBRAINZ_CLIENT_ID + MUSICBRAINZ_CLIENT_SECRET required for per-user music sync",
          "Add MusicBrainz OAuth app callback: {APP_URL}/api/connectors/listenbrainz/callback",
        ),

    openAlexReady
      ? item(
          "openalex",
          "OpenAlex research sensor",
          "ready",
          "OpenAlex polite pool configured — citation toll sensor can run",
        )
      : item(
          "openalex",
          "OpenAlex research sensor",
          "partial",
          "OpenAlex works without a key; add OPENALEX_API_KEY or OPENALEX_EMAIL for higher limits",
        ),

    navidromeEnv || navidromeSecret
      ? item(
          "navidrome",
          "Navidrome scrobble ingress",
          scrobbleIngress ? "ready" : navidromePing.ok ? "partial" : "partial",
          navidromePing.ok
            ? `Navidrome reachable · ${navidromePing.message}`
            : navidromeSecret
              ? "Bridge secret set — run scripts/navidrome-bridge.ts on your Navidrome host"
              : "Navidrome env present but ping failed — check URL/credentials or use bridge",
          "Run bridge: NAVIDROME_DB_PATH=... RESOLVE_SYNC_URL=... npx tsx scripts/navidrome-bridge.ts",
        )
      : item(
          "navidrome",
          "Navidrome scrobble ingress",
          "partial",
          "No operator Navidrome — external users can still sync via ListenBrainz OAuth",
          "Optional: set NAVIDROME_URL + credentials, or NAVIDROME_SYNC_SECRET + bridge",
        ),

    registryCount > 0
      ? item(
          "registry",
          "Artist payee registry",
          "ready",
          `${registryCount} production artist row(s) with wallet resolution`,
          "Profile → link artist wallet for any new payees",
          "/profile",
        )
      : item(
          "registry",
          "Artist payee registry",
          "blocked",
          "No production artist wallets — deploy will leave music payees unresolved",
          "POST /api/registry/seed-production (cron auth) or set PRODUCTION_ARTIST_REGISTRY JSON",
        ),

    treasuryFunded
      ? item(
          "treasury",
          "Arc treasury funded",
          onChainReady ? "ready" : "partial",
          onChainReady
            ? `$${(arc.balanceUsd ?? 0).toFixed(2)} USDC · on-chain memo payouts ready`
            : `$${(arc.balanceUsd ?? 0).toFixed(2)} USDC · ${arc.blockers[0] ?? "check Arc config"}`,
          "Fund ARC_CLIENT_WALLET_ADDRESS on Arc testnet",
          "https://faucet.circle.com",
        )
      : item(
          "treasury",
          "Arc treasury funded",
          "blocked",
          arc.blockers[0] ?? "Treasury wallet has no USDC — batches cannot settle on-chain",
          "Fund ARC_CLIENT_WALLET_ADDRESS on Arc testnet",
          "https://faucet.circle.com",
        ),

    githubOAuth
      ? item(
          "claims",
          "Universal claims sign-in",
          "ready",
          "GitHub OAuth enabled in Supabase — /claim works for external creators",
          "Share /claim with external GitHub users",
          "/claim",
        )
      : item(
          "claims",
          "Universal claims sign-in",
          "blocked",
          "GitHub OAuth not enabled in Supabase — external users cannot sign in to /claim",
          "Supabase → Authentication → Providers → GitHub",
        ),

    externalUsers > 0
      ? item(
          "traction",
          "External user traction",
          "ready",
          `${externalUsers} user(s) with GitHub or ListenBrainz linked`,
        )
      : item(
          "traction",
          "External user traction",
          "partial",
          "No external identities yet — invite one tester with GitHub or ListenBrainz",
          "Share /profile and /claim with a friend",
          "/profile",
        ),

    cronSecret
      ? item(
          "cron",
          "Cron / claim tokens",
          "ready",
          "CRON_SECRET or CLAIM_TOKEN_SECRET configured — bootstrap + claim links work",
        )
      : item(
          "cron",
          "Cron / claim tokens",
          "blocked",
          "CRON_SECRET missing — sensor tick and bootstrap endpoints are locked",
          "Generate CRON_SECRET in Vercel",
        ),
  ];

  const readyCount = items.filter((i) => i.status === "ready").length;
  const partialCount = items.filter((i) => i.status === "partial").length;
  const score = readyCount + partialCount * 0.5;

  return {
    ok: items.every((i) => i.status !== "blocked"),
    score,
    total: items.length,
    liveUrl,
    demoMode,
    items,
    paths: {
      music: [
        "Discover → Install Independent Music",
        "Profile → Connect ListenBrainz",
        "Profile → Link artist wallet (MusicBrainz registry)",
        "Listen / run navidrome-bridge → POST /api/connectors/sensors/sync",
        "Capital → Fund program → Deploy → /claim",
      ],
      bounty: [
        "Discover → Install React or Linux",
        "POST /api/cron/bootstrap-sensors (operator)",
        "Fund docs program → Deploy when authorizations appear",
        "Creator merges PR or docs sensor fires → /claim",
      ],
      claim: [
        "Enable GitHub OAuth in Supabase",
        "Fund ARC_CLIENT_WALLET_ADDRESS",
        "Creator visits /claim → signs in → Collect earnings",
      ],
    },
  };
}
