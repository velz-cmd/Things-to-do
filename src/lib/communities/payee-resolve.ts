import type { DistributionPlatform } from "@/lib/gateway/types";
import { resolvePayee, type PayeeResolution } from "@/lib/registry/resolvers";

/** Map authorization payee types to the distribution platform resolver expects. */
export function payeePlatformForAuthorization(
  communityKind: string,
  connectors: string[],
  payeeKeyType?: string | null,
): DistributionPlatform {
  if (payeeKeyType === "github_username") return "github";
  if (payeeKeyType?.startsWith("listen_") || payeeKeyType === "musicbrainz_artist") {
    return "navidrome";
  }
  if (payeeKeyType === "wallet") return "generic";
  if (connectors.includes("github") || communityKind === "oss") return "github";
  if (connectors.includes("jellyfin") || communityKind === "media") return "jellyfin";
  if (
    connectors.includes("navidrome") ||
    connectors.includes("listenbrainz") ||
    communityKind === "music"
  ) {
    return "navidrome";
  }
  return "generic";
}

/** Build resolver payload from ledger payee key + type. */
export function payeePayloadForAuthorization(
  payeeKey: string,
  payeeKeyType?: string | null,
): Record<string, unknown> {
  if (payeeKeyType === "github_username") {
    return { githubUsername: payeeKey, github: payeeKey };
  }
  if (payeeKeyType?.startsWith("listen_") || payeeKeyType === "musicbrainz_artist") {
    return { exifArtist: payeeKey, artist: payeeKey, listenArtist: payeeKey, artistName: payeeKey };
  }
  if (payeeKeyType === "openalex_author") {
    return { payeeName: payeeKey };
  }
  if (payeeKeyType === "wallet" && payeeKey.startsWith("0x")) {
    return { payeeWallet: payeeKey, wallet: payeeKey };
  }
  return { payeeName: payeeKey, githubUsername: payeeKey, github: payeeKey };
}

export async function resolveAuthorizationPayee(input: {
  communityKind: string;
  connectors: string[];
  payeeKey: string;
  payeeKeyType?: string | null;
}): Promise<PayeeResolution> {
  const platform = payeePlatformForAuthorization(
    input.communityKind,
    input.connectors,
    input.payeeKeyType,
  );
  const payload = payeePayloadForAuthorization(input.payeeKey, input.payeeKeyType);
  return resolvePayee({ platform, payload });
}

/** User-facing hint when no authorizations exist yet — varies by community kind. */
export function noAuthorizationsHint(communityKind: string, connectors: string[]): string {
  if (communityKind === "music" || connectors.includes("listenbrainz")) {
    return "Connect ListenBrainz on Profile — plays sync automatically";
  }
  if (communityKind === "oss" || connectors.includes("github")) {
    return "Connect GitHub on Profile — merges sync via the docs sensor";
  }
  if (communityKind === "media" || connectors.includes("jellyfin")) {
    return "Connect Jellyfin on Profile — watch events sync automatically";
  }
  if (communityKind === "research" || connectors.includes("openalex")) {
    return "Run OpenAlex sensor — citations appear when upstream activity is recognized";
  }
  return "Run live sensors — authorizations appear when upstream activity is recognized";
}
