const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

export function googleOAuthConfigured(): boolean {
  return Boolean(
    (process.env.GMAIL_CLIENT_ID?.trim() || process.env.GOOGLE_CLIENT_ID?.trim()) &&
      (process.env.GMAIL_CLIENT_SECRET?.trim() || process.env.GOOGLE_CLIENT_SECRET?.trim()),
  );
}

function googleClientId() {
  return process.env.GMAIL_CLIENT_ID?.trim() || process.env.GOOGLE_CLIENT_ID!.trim();
}

function googleClientSecret() {
  return process.env.GMAIL_CLIENT_SECRET?.trim() || process.env.GOOGLE_CLIENT_SECRET!.trim();
}

export function appOrigin() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    process.env.APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

export function gmailRedirectUri() {
  return `${appOrigin()}/api/connectors/gmail/callback`;
}

export function buildGmailAuthorizeUrl(state: string, sendAccess = false) {
  const clientId = googleClientId();
  const scopes = sendAccess
    ? [GMAIL_READONLY_SCOPE, GMAIL_SEND_SCOPE]
    : [GMAIL_READONLY_SCOPE];

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: gmailRedirectUri(),
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
      redirect_uri: gmailRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description ?? data.error ?? "Gmail OAuth failed");
  }

  return data;
}
