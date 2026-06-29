import { syncUserMusicSensors, syncAllUsersMusicSensors } from "@/lib/connectors/user-music-sync";
import {
  syncUserGithubSensors,
  syncUserOpenAlexSensors,
  syncAllUsersGithubSensors,
  syncAllUsersOpenAlexSensors,
} from "@/lib/connectors/user-github-sync";
import { syncUserJellyfinSensors } from "@/lib/connectors/user-jellyfin-sync";

/** All observation sensors for one user — music, video, code, research. */
export async function syncUserSensors(userId: string) {
  const [music, jellyfin, github, openAlex] = await Promise.all([
    syncUserMusicSensors(userId).catch((e) => ({
      ok: false as const,
      ingested: 0,
      error: e instanceof Error ? e.message : "music_sync_failed",
    })),
    syncUserJellyfinSensors(userId).catch((e) => ({
      ok: false as const,
      ingested: 0,
      error: e instanceof Error ? e.message : "jellyfin_sync_failed",
    })),
    syncUserGithubSensors(userId).catch((e) => ({
      ok: false as const,
      ingested: 0,
      error: e instanceof Error ? e.message : "github_sync_failed",
    })),
    syncUserOpenAlexSensors(userId).catch((e) => ({
      ok: false as const,
      ingested: 0,
      error: e instanceof Error ? e.message : "openalex_sync_failed",
    })),
  ]);

  const ingested =
    (music.ingested ?? 0) +
    (jellyfin.ingested ?? 0) +
    (github.ingested ?? 0) +
    (openAlex.ingested ?? 0);

  return {
    ok: true as const,
    ingested,
    music,
    jellyfin,
    github,
    openAlex,
  };
}

/** Cron — sync every installed user globally. */
export async function syncAllUsersSensors(limit = 40) {
  const [music, github, openAlex] = await Promise.all([
    syncAllUsersMusicSensors(limit).catch((e) => ({
      error: e instanceof Error ? e.message : "music_batch_failed",
    })),
    syncAllUsersGithubSensors(limit).catch((e) => ({
      error: e instanceof Error ? e.message : "github_batch_failed",
    })),
    syncAllUsersOpenAlexSensors(limit).catch((e) => ({
      error: e instanceof Error ? e.message : "openalex_batch_failed",
    })),
  ]);

  return { ok: true as const, music, github, openAlex };
}
