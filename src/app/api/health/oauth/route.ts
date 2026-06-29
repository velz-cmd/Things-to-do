import { NextResponse } from "next/server";
import { githubOAuthConfigured, githubOAuthRedirectUri } from "@/lib/integrations/github-oauth";
import {
  listenBrainzOAuthRedirectUri,
  musicBrainzOAuthConfigured,
  appOrigin,
} from "@/lib/integrations/musicbrainz-oauth";

export const dynamic = "force-dynamic";

/** OAuth redirect URIs and setup checklist — no secrets. */
export async function GET(req: Request) {
  const origin = appOrigin(new URL(req.url).origin);
  const githubCallback = githubOAuthRedirectUri(origin);
  const listenbrainzCallback = listenBrainzOAuthRedirectUri(origin);

  return NextResponse.json({
    ok: true,
    appOrigin: origin,
    github: {
      configured: githubOAuthConfigured(),
      callbackUrl: githubCallback,
      authorizeUrl: `${origin}/connect/github`,
      registerAt: "https://github.com/settings/developers",
      steps: [
        `Open GitHub → Settings → Developer settings → OAuth Apps → your app (client for RESOLVE)`,
        `Set Authorization callback URL exactly to: ${githubCallback}`,
        "Save — no trailing slash, must be https on production",
      ],
    },
    listenbrainz: {
      configured: musicBrainzOAuthConfigured(),
      callbackUrl: listenbrainzCallback,
      authorizeUrl: `${origin}/connect/listenbrainz`,
      registerAt: "https://musicbrainz.org/account/applications",
      steps: [
        `Open MusicBrainz → My Account → Applications → your RESOLVE app`,
        `Set OAuth2 redirect URI exactly to: ${listenbrainzCallback}`,
        "If already signed in to musicbrainz.org, you'll only see Authorize (one tap)",
      ],
      note:
        "MusicBrainz login page is hosted by MusicBrainz — RESOLVE cannot restyle it. Stay signed in at musicbrainz.org in this browser for one-tap authorize.",
    },
  });
}
