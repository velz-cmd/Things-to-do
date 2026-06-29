export const CONNECTOR_LABELS: Record<string, string> = {
  github: "GitHub",
  navidrome: "Navidrome",
  listenbrainz: "ListenBrainz",
  musicbrainz: "MusicBrainz",
  jellyfin: "Jellyfin",
  openalex: "OpenAlex",
  opencollective: "Open Collective",
  immich: "Immich",
};

export function connectorLabel(connectorId: string): string {
  return CONNECTOR_LABELS[connectorId] ?? connectorId.replace(/_/g, " ");
}

export function payeeDisplayLabel(payeeKeyType: string, payeeKey: string): string {
  if (payeeKeyType === "github_username") return `@${payeeKey}`;
  if (payeeKeyType === "wallet") {
    return payeeKey.length > 12 ?
        `${payeeKey.slice(0, 6)}…${payeeKey.slice(-4)}`
      : payeeKey;
  }
  return payeeKey;
}

export function payeeRoleLabel(payeeKeyType: string): string {
  if (payeeKeyType === "github_username") return "Maintainer";
  if (payeeKeyType.startsWith("listen_")) return "Artist / credit";
  if (payeeKeyType === "musicbrainz_artist") return "Artist";
  if (payeeKeyType === "wallet") return "Wallet";
  return "Payee";
}
