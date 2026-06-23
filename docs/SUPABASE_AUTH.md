# Supabase auth setup (Google + email OTP)

## Redirect URLs (Supabase Dashboard → Authentication → URL Configuration)

- **Site URL:** `https://resolve-task.vercel.app`
- **Redirect URLs:**
  - `https://resolve-task.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback`

## Google sign-in

1. Supabase → **Authentication** → **Providers** → **Google** → Enable
2. Paste your Google Cloud OAuth **Client ID** and **Client Secret**
3. Authorized redirect URI in Google Cloud Console must include:
   `https://jjducnguljjddciczvuy.supabase.co/auth/v1/callback`

App env vars `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are for Gmail agent tools only — **not** Supabase OAuth.

## Email login code (OTP)

1. Supabase → **Authentication** → **Email** → enable Email provider
2. Email template should include `{{ .Token }}` for 6-digit codes (default OTP template)
3. RESOLVE verifies codes client-side via `verifyOtp`

New users receive a welcome / activation email from Resend after first verification.
