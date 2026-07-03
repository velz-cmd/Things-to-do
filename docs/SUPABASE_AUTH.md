# Supabase auth setup (Google + email/password)

## Redirect URLs (Supabase Dashboard → Authentication → URL Configuration)

- **Site URL:** `https://things-to-do-eta.vercel.app` (production) or `http://localhost:3000` (local dev)
- **Redirect URLs** (add every host you use; wildcards are supported):
  - `https://things-to-do-eta.vercel.app/**`
  - `https://things-to-do-eta.vercel.app/auth/reset-password`
  - `http://localhost:3000/**`

If `/auth/callback` is missing from the allowlist, Supabase falls back to Site URL and you will land on `/?code=...` without a session. The app middleware forwards that to `/auth/callback`, but you should still add the URLs above so OAuth sign-in completes in one hop.

## Email sign-in (email + password)

Users sign in with **email and password** — no magic link or 6-digit code. Passwords are stored securely by Supabase (hashed); the app only remembers the email address on the device when the user checks “Remember my email”.

### Supabase setup

1. Supabase → **Authentication** → **Providers** → **Email** → Enable
2. **Disable “Confirm email”** for instant sign-in without inbox verification (recommended for global self-serve)
3. Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set on Vercel

### Email delivery (avoid Supabase rate limits)

Supabase’s **built-in email** has strict limits (~4/hour, ~60s between sends). Password reset emails are sent by **Resend** or **Brevo** instead — Supabase only creates the secure link.

**Recommended — Brevo (free, no domain, 300 emails/day):**

1. Sign up at [brevo.com](https://www.brevo.com)
2. **Senders** → verify your Gmail (e.g. `abdullahlp114@gmail.com`)
3. **SMTP & API** → **API keys** tab → create an API key (starts with `xkeysib-`)
   - Do **not** use the SMTP key (`xsmtpsib-`) — that only works for SMTP relay, not our REST API
4. Add on **Vercel** (check **Production** + **Preview**):
   - `BREVO_API_KEY` = your API key
   - `BREVO_FROM_EMAIL` = verified sender Gmail
   - `BREVO_FROM_NAME` = `RESOLVE` (optional)
5. **Redeploy** after saving env vars — Vercel does not inject new secrets until the next deploy
6. Verify: `GET /api/health/email` should show `brevo.ok: true` and `primary: "brevo"` when Resend is sandbox-only

**Alternative — Resend:** set `RESEND_API_KEY` + verified `RESEND_FROM_EMAIL` (needs a domain for all users).

### User flow

- **Continue:** returning users sign in; new users get an account automatically
- **Forgot password:** “Set your password” email → tap **Continue to set password** on `/auth/reset-password` (stops Gmail link prefetch from burning the token)
- **Remember me:** email saved locally only — never the password


## Google sign-in

1. Supabase → **Authentication** → **Providers** → **Google** → Enable
2. Paste your Google Cloud OAuth **Client ID** and **Client Secret**
3. Authorized redirect URI in Google Cloud Console must include:
   `https://jjducnguljjddciczvuy.supabase.co/auth/v1/callback`
4. The app starts OAuth via `/api/auth/oauth/google` (server redirect with PKCE cookies)

App env vars `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are for Gmail agent tools only — **not** Supabase OAuth.

## GitHub sign-in

Same redirect URL rules as Google. OAuth starts at `/api/auth/oauth/github`.
