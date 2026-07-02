# Supabase auth setup (Google + email/password)

## Redirect URLs (Supabase Dashboard → Authentication → URL Configuration)

- **Site URL:** `https://things-to-do-eta.vercel.app` (production) or `http://localhost:3000` (local dev)
- **Redirect URLs** (add every host you use; wildcards are supported):
  - `https://things-to-do-eta.vercel.app/**`
  - `http://localhost:3000/**`
  - `https://resolve-task.vercel.app/**` (legacy, optional)

If `/auth/callback` is missing from the allowlist, Supabase falls back to Site URL and you will land on `/?code=...` without a session. The app middleware forwards that to `/auth/callback`, but you should still add the URLs above so OAuth sign-in completes in one hop.

## Email sign-in (email + password)

Users sign in with **email and password** — no magic link or 6-digit code. Passwords are stored securely by Supabase (hashed); the app only remembers the email address on the device when the user checks “Remember my email”.

### Supabase setup

1. Supabase → **Authentication** → **Providers** → **Email** → Enable (the screen in your screenshot is correct)
2. **Turn off “Confirm email”** — this is **not** inside the Email provider popup. Close that popup, then on the same **Sign In / Providers** page scroll up to the **User signups** section at the top. You should see:
   - **Allow new users to sign up** — ON
   - **Confirm email** — turn **OFF** (users sign in immediately after creating an account)
3. Click **Save** at the bottom of the page
4. Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set on Vercel

If you only see the Email provider modal, click **Cancel**, scroll the main Providers page upward — **Confirm email** lives in the general signup settings above the provider list, not inside the Email toggles.

### User flow

- **Sign in:** existing users enter email + password
- **Create account:** new users choose “Create an account”, set a password (6+ characters), and are signed in immediately (when confirm email is off)
- **Remember me:** email is saved in browser `localStorage` — passwords are never stored locally

## Google sign-in

1. Supabase → **Authentication** → **Providers** → **Google** → Enable
2. Paste your Google Cloud OAuth **Client ID** and **Client Secret**
3. Authorized redirect URI in Google Cloud Console must include:
   `https://jjducnguljjddciczvuy.supabase.co/auth/v1/callback`
4. The app starts OAuth via `/api/auth/oauth/google` (server redirect with PKCE cookies)

App env vars `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are for Gmail agent tools only — **not** Supabase OAuth.

## GitHub sign-in

Same redirect URL rules as Google. OAuth starts at `/api/auth/oauth/github`.
