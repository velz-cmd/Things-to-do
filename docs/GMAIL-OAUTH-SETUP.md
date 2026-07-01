# Gmail OAuth — fix `invalid_grant`

**Setup API (no secrets):** `GET https://resolve-task.vercel.app/api/connectors/gmail/setup`

## What `invalid_grant` means

Your Vercel **`GOOGLE_REFRESH_TOKEN`** was issued for a **different** OAuth Client ID than the **`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`** in Vercel. Google rejects the combination.

You have two Gmail-related OAuth apps in your notes — you must use **one** pair consistently.

---

## Fix in 5 minutes

### 1. Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. Pick **one** OAuth 2.0 Client ID (Web application) for RESOLVE Gmail
3. **Authorized redirect URIs** — add exactly:

   ```
   https://resolve-task.vercel.app/api/connectors/gmail/callback
   ```

4. **APIs & Services** → **Library** → enable **Gmail API**

5. If app is in **Testing**: **OAuth consent screen** → add your Google account under **Test users**

### 2. Vercel environment variables

| Variable | Value |
|----------|--------|
| `GOOGLE_CLIENT_ID` | Client ID from step 1 |
| `GOOGLE_CLIENT_SECRET` | Client secret from step 1 |
| `GOOGLE_REFRESH_TOKEN` | **Delete this variable** (stale token causes invalid_grant) |

Optional: use `GMAIL_CLIENT_ID` + `GMAIL_CLIENT_SECRET` instead if you want a dedicated Gmail-only OAuth app.

Redeploy after saving.

### 3. Connect while signed in

1. Go to https://resolve-task.vercel.app and **sign in**
2. Open **Profile** → **Connect Gmail**  
   Or visit directly (after sign-in):  
   https://resolve-task.vercel.app/api/connectors/gmail/authorize?returnTo=/profile
3. Approve Gmail read access
4. You should land on Profile with `gmail_connected=1`

The refresh token is stored **per user in the database** — you do not need `GOOGLE_REFRESH_TOKEN` in Vercel unless the Mission server agent must read Gmail without a signed-in user.

### 4. Verify (no `jq` needed)

```bash
curl -s https://resolve-task.vercel.app/api/status/production
```

Look for `"gmail":{"ok":true` in the JSON.

Or:

```bash
curl -s https://resolve-task.vercel.app/api/connectors/gmail/setup
```

---

## Optional: server refresh token (Mission agent only)

Only if you need Gmail tools without a user session:

1. Complete step 3 above while signed in
2. Use [Google OAuth Playground](https://developers.google.com/oauthplayground/) with the **same** Client ID/Secret
3. Scope: `https://www.googleapis.com/auth/gmail.readonly`
4. Exchange code → copy **refresh token** → set `GOOGLE_REFRESH_TOKEN` in Vercel

If you rotate Client Secret, generate a new refresh token.
