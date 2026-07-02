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

**You do not need a custom domain.** The app works out of the box for any inbox.

### How delivery works (automatic)

| Setup | Who sends the email | Works for any user? | Good for |
|-------|---------------------|---------------------|----------|
| **Nothing extra** (default) | Supabase built-in email | Yes | Getting started, light traffic |
| **Brevo SMTP** (recommended, free, no domain) | Supabase → Brevo → user inbox | Yes | Hundreds of users/day |
| **Resend + domain** (optional later) | Branded email from your domain | Yes | High volume + custom branding |

The app always tries **Supabase magic link** first. Resend is only used when `RESEND_FROM_EMAIL` is set to a verified domain — skip this if you do not have a domain.

### Default — works today, no domain

1. Supabase → **Authentication** → **Email** → enable provider
2. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set on Vercel
3. Magic link redirect uses `APP_URL` / `NEXT_PUBLIC_APP_URL` → `/auth/callback`

Supabase sends the magic link to **any** email address globally. On the free tier there is a low hourly send quota (~4/hour per project). That is a Supabase platform limit, not something the app enforces.

### Scale to hundreds of users — Brevo (free, no domain required)

Use any Gmail or email you already control. No `auth@yourdomain.com` needed.

1. Sign up at [brevo.com](https://www.brevo.com) (free — 300 emails/day)
2. **Senders** → add and verify your sender (e.g. `podrift.mail@gmail.com`) via the confirmation link Brevo sends
3. **SMTP & API** → create an SMTP key
4. Supabase → **Authentication** → **SMTP Settings** → enable custom SMTP:

| Field | Value |
|-------|--------|
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | Your Brevo account email |
| Password | Brevo SMTP key (not your login password) |
| Sender email | The verified sender from step 2 (your Gmail) |
| Sender name | `RESOLVE` |

5. Save — Supabase now sends magic links through Brevo to **any** inbox, with no domain purchase.

Do **not** put Google OAuth credentials or your personal email password in SMTP fields.

### Optional later — Resend + custom domain

Only if you buy a domain and want branded `auth@yourdomain.com` emails:

| Field | Value |
|-------|--------|
| Host | `smtp.resend.com` |
| Port | `465` or `587` |
| Username | `resend` |
| Password | `RESEND_API_KEY` |
| Sender email | Verified address on your domain |

Also set `RESEND_FROM_EMAIL` on Vercel if you want the app’s Resend API path for welcome/notification emails.

## Google sign-in

1. Supabase → **Authentication** → **Providers** → **Google** → Enable
2. Paste your Google Cloud OAuth **Client ID** and **Client Secret**
3. Authorized redirect URI in Google Cloud Console must include:
   `https://jjducnguljjddciczvuy.supabase.co/auth/v1/callback`
4. The app starts OAuth via `/api/auth/oauth/google` (server redirect with PKCE cookies)

App env vars `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are for Gmail agent tools only — **not** Supabase OAuth.

## GitHub sign-in

Same redirect URL rules as Google. OAuth starts at `/api/auth/oauth/github`.
