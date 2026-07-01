import { prisma } from "@/lib/db";
import {
  getGoogleOAuthClientId,
  getGoogleOAuthClientSecret,
  googleOAuthConfigured,
} from "@/lib/google/oauth";

/** Resolve a Gmail refresh token: per-user DB token, then server env fallback. */
export async function getGmailRefreshToken(userId?: string | null): Promise<string | null> {
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { gmailConnected: true, gmailRefreshToken: true },
    });
    if (user?.gmailConnected && user.gmailRefreshToken) {
      return user.gmailRefreshToken;
    }
  }

  return (
    process.env.GMAIL_REFRESH_TOKEN?.trim() ??
    process.env.GOOGLE_REFRESH_TOKEN?.trim() ??
    null
  );
}

export async function isGmailConnectedForUser(userId?: string | null): Promise<boolean> {
  if (!googleOAuthConfigured()) return false;

  const refresh = await getGmailRefreshToken(userId);
  if (refresh) return true;

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { gmailConnected: true },
    });
    return user?.gmailConnected ?? false;
  }

  return false;
}

export async function refreshGmailAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getGoogleOAuthClientId(),
      client_secret: getGoogleOAuthClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) {
    throw new Error(data.error ?? "Gmail token refresh failed");
  }
  return data.access_token;
}

export async function getGmailAccessToken(userId?: string | null): Promise<string | null> {
  const refresh = await getGmailRefreshToken(userId);
  if (!refresh || !googleOAuthConfigured()) return null;
  return refreshGmailAccessToken(refresh);
}
