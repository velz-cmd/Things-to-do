# Supabase auth setup (Google + email magic link)

## Redirect URLs (Supabase Dashboard → Authentication → URL Configuration)

- **Site URL:** `https://things-to-do-eta.vercel.app` (production) or `http://localhost:3000` (local dev)
- **Redirect URLs** (add every host you use; wildcards are supported):
  - `https://things-to-do-eta.vercel.app/**`
  - `http://localhost:3000/**`
  - `https://resolve-task.vercel.app/**` (legacy, optional)

If `/auth/callback` is missing from the allowlist, Supabase falls back to Site URL and you will land on `/?code=...` without a session. The app middleware forwards that to `/auth/callback`, but you should still add the URLs above so sign-in completes in one hop.

## Email sign-in (magic link only)

Email magic links are sent **server-side** via `/api/auth/send-code`. Users tap the link in their inbox — there is no 6-digit code step in the app.

For reliable delivery to **any** inbox (global users, no manual involvement):

1. Supabase → **Authentication** → **Email** → enable provider
2. Supabase → **Authentication** → **SMTP Settings** → **Enable custom SMTP** (Resend):

| Field | Value |
|-------|--------|
| Host | `smtp.resend.com` |
| Port | `465` or `587` |
| Username | `resend` |
| Password | Your `RESEND_API_KEY` from Vercel |
| Sender email | Verified address in Resend (e.g. `auth@yourdomain.com`) |
| Sender name | `RESOLVE` |

Do **not** use Google OAuth Client ID/Secret or your personal password as SMTP credentials.

3. Resend → verify your sending domain, then set `RESEND_FROM_EMAIL` on Vercel to that address (enables branded Resend delivery as a fallback path)
4. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set on Vercel (required for server-side send)
5. Magic link redirect uses `APP_URL` / `NEXT_PUBLIC_APP_URL` → `/auth/callback`

Until custom SMTP is enabled, Supabase's built-in email has a low hourly quota (~4/hour). Custom SMTP via Resend removes that limit for production scale.

## Google sign-in

1. Supabase → **Authentication** → **Providers** → **Google** → Enable
2. Paste your Google Cloud OAuth **Client ID** and **Client Secret**
3. Authorized redirect URI in Google Cloud Console must include:
   `https://jjducnguljjddciczvuy.supabase.co/auth/v1/callback`
4. The app starts OAuth via `/api/auth/oauth/google` (server redirect with PKCE cookies)

App env vars `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are for Gmail agent tools only — **not** Supabase OAuth.

## GitHub sign-in

Same redirect URL rules as Google. OAuth starts at `/api/auth/oauth/github`.
