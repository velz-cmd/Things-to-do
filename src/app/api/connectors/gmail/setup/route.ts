import { NextResponse } from "next/server";
import {
  gmailRedirectUri,
  googleOAuthConfigured,
} from "@/lib/google/oauth";

function maskClientId(clientId: string): string {
  if (clientId.length <= 12) return `${clientId.slice(0, 4)}…`;
  return `${clientId.slice(0, 12)}…${clientId.slice(-8)}`;
}

/** Copy-paste Gmail OAuth setup — no secrets returned. */
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const clientId =
    process.env.GMAIL_CLIENT_ID?.trim() || process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const redirectUri = gmailRedirectUri();

  return NextResponse.json({
    ok: googleOAuthConfigured(),
    redirectUri,
    clientIdConfigured: Boolean(clientId),
    clientIdMask: clientId ? maskClientId(clientId) : null,
    usesGmailSpecificClient: Boolean(process.env.GMAIL_CLIENT_ID?.trim()),
    authorizeUrl: `${origin}/api/connectors/gmail/authorize?returnTo=/profile`,
    profileUrl: `${origin}/profile`,
    steps: [
      "Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client (Web application)",
      `Authorized redirect URI (exact): ${redirectUri}`,
      "Enable Gmail API on the same Google Cloud project",
      "Vercel env: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET must match that OAuth client (or use GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET)",
      "Delete stale GOOGLE_REFRESH_TOKEN from Vercel if you see invalid_grant",
      `Sign in at ${origin} → Profile → Connect Gmail (or open authorizeUrl while signed in)`,
      "OAuth stores refresh token per user in database — server GOOGLE_REFRESH_TOKEN is optional for Mission agent only",
    ],
    commonMistakes: [
      "Refresh token generated with a different Client ID than the one in Vercel",
      "Redirect URI typo (http vs https, trailing slash)",
      "OAuth app in Testing mode without your Google account as test user",
      "Reusing an old refresh token after rotating client secret",
    ],
  });
}
