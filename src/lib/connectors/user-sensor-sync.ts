import { syncUserMusicSensors, syncAllUsersMusicSensors } from "@/lib/connectors/user-music-sync";
import {
  syncUserGithubSensors,
  syncUserOpenAlexSensors,
  syncAllUsersGithubSensors,
  syncAllUsersOpenAlexSensors,
} from "@/lib/connectors/user-github-sync";

/** All observation sensors for one user — music, code, research. No operator keys required. */
export async function syncUserSensors(userId: string) {
  const [music, github, openAlex] = await Promise.all([
    syncUserMusicSensors(userId).catch((e) => ({
      ok: false as const,
      ingested: 0,
      error: e instanceof Error ? e.message : "music_sync_failed",
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
    (music.ingested ?? 0) + (github.ingested ?? 0) + (openAlex.ingested ?? 0);

  return {
    ok: true as const,
    ingested,
    music,
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
