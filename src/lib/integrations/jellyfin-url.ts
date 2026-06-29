/** Whether RESOLVE cloud (Vercel) can reach this Jellyfin host directly. */
export function isPrivateJellyfinUrl(raw: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(raw.trim()).hostname.toLowerCase();
  } catch {
    return true;
  }
  return isPrivateOrLocalHost(hostname);
}

export function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) return true;
  if (host === "::1" || host.startsWith("fe80:")) return true;

  const v4 = parseIpv4(host);
  if (!v4) return false;

  const [a, b] = v4;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;

  return false;
}

function parseIpv4(host: string): [number, number, number, number] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return nums as [number, number, number, number];
}

export function jellyfinReachabilityHint(url: string): string | undefined {
  if (!isPrivateJellyfinUrl(url)) return undefined;
  return (
    "Local or private IP — RESOLVE cloud cannot reach this server directly. " +
    "Create an API key in Jellyfin → Dashboard → Advanced → API Keys, paste it below, " +
    "then run scripts/jellyfin-bridge.ts on the same PC as Jellyfin."
  );
}
