# Supabase auth setup (Google + email OTP)

## Redirect URLs (Supabase Dashboard → Authentication → URL Configuration)

- **Site URL:** `https://things-to-do-eta.vercel.app` (production) or `http://localhost:3000` (local dev)
- **Redirect URLs** (add every host you use; wildcards are supported):
  - `https://things-to-do-eta.vercel.app/**`
  - `http://localhost:3000/**`
  - `https://resolve-task.vercel.app/**` (legacy, optional)

If `/auth/callback` is missing from the allowlist, Supabase falls back to Site URL and you will land on `/?code=...` without a session. The app middleware forwards that to `/auth/callback`, but you should still add the URLs above so sign-in completes in one hop.

## Email sign-in (magic link)

Email links are sent **server-side** via Supabase (`/api/auth/send-code`). For reliable delivery in production:

1. Supabase → **Authentication** → **Email** → enable provider
2. Supabase → **Authentication** → **SMTP Settings** — use Resend (not Google OAuth credentials):

| Field | Value |
|-------|--------|
| Host | `smtp.resend.com` |
| Port | `465` or `587` |
| Username | `resend` |
| Password | Your `RESEND_API_KEY` from Vercel |
| Sender email | Verified address in Resend |
| Sender name | `RESOLVE` |

Do **not** use Google OAuth Client ID/Secret or your personal password as SMTP credentials.
3. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set on Vercel (required for server-side send)
4. Magic link redirect uses `APP_URL` / `NEXT_PUBLIC_APP_URL` → `/auth/callback`

## Google sign-in

1. Supabase → **Authentication** → **Providers** → **Google** → Enable
2. Paste your Google Cloud OAuth **Client ID** and **Client Secret**
3. Authorized redirect URI in Google Cloud Console must include:
   `https://jjducnguljjddciczvuy.supabase.co/auth/v1/callback`
4. The app starts OAuth via `/api/auth/oauth/google` (server redirect with PKCE cookies)

App env vars `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are for Gmail agent tools only — **not** Supabase OAuth.

## GitHub sign-in

Same redirect URL rules as Google. OAuth starts at `/api/auth/oauth/github`.

## Email login code (OTP)

1. Supabase → **Authentication** → **Email** → enable Email provider
2. Email template should include `{{ .Token }}` for 6-digit codes (default OTP template)
3. RESOLVE verifies codes client-side via `verifyOtp`

New users receive a welcome / activation email from Resend after first verification.
