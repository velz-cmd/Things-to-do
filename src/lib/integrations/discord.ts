import { env, isConfigured } from "@/lib/integrations/config";

export type DiscordGuildSnapshot = {
  id: string;
  name: string;
  memberCount?: number;
  url?: string;
};

export function isDiscordConfigured(): boolean {
  return isConfigured("DISCORD_BOT_TOKEN");
}

function botHeaders(): Record<string, string> {
  return {
    Authorization: `Bot ${env("DISCORD_BOT_TOKEN")}`,
    "User-Agent": "RESOLVE/1.0 (https://resolve-self.vercel.app)",
  };
}

export async function pingDiscord(): Promise<{ ok: boolean; message: string }> {
  if (!isDiscordConfigured()) {
    return { ok: false, message: "DISCORD_BOT_TOKEN not set" };
  }
  try {
    const res = await fetch("https://discord.com/api/v10/users/@me", {
      headers: botHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { ok: false, message: `Discord HTTP ${res.status}` };
    const json = (await res.json()) as { username?: string };
    return { ok: true, message: `Discord bot connected · @${json.username ?? "bot"}` };
  } catch {
    return { ok: false, message: "Discord unreachable" };
  }
}

export async function getDiscordGuildSnapshot(): Promise<DiscordGuildSnapshot | null> {
  const guildId = env("DISCORD_GUILD_ID");
  if (!isDiscordConfigured() || !guildId) return null;

  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}?with_counts=true`, {
      headers: botHeaders(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { id: string; name: string; approximate_member_count?: number };
    return {
      id: json.id,
      name: json.name,
      memberCount: json.approximate_member_count,
      url: `https://discord.com/channels/${json.id}`,
    };
  } catch {
    return null;
  }
}
