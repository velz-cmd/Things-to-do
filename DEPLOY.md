# Deploy RESOLVE to Vercel

## The problem

**GitHub `main` has the new RESOLVE UI.** Production at https://resolve-task.vercel.app is still serving an **old build** (commit `4a7829a` — DEPUTY landing page).

Verify:

```bash
# Should return 200 after a successful deploy (currently 404 on old build)
curl -sI https://resolve-task.vercel.app/tasks | head -1
```

Latest code on GitHub: `0412af5` — RESOLVE Overview / Tasks / Vault.

---

## Fix now (2 minutes — Vercel dashboard)

1. Open https://vercel.com → project **things-to-do**
2. Go to **Deployments**
3. Check if there are **failed** builds for commits after `4a7829a`. If yes, open the log and fix the error.
4. If no recent deployments exist, click **Create Deployment** (top right):
   - Branch: `main`
   - Environment: **Production**
   - Click **Deploy**
5. Wait for **Ready**, then open https://resolve-task.vercel.app — you should see **RESOLVE** sidebar with Overview / Tasks / Vault.

**Alternative:** open the latest successful Preview deployment (if it shows RESOLVE UI) → **⋯** → **Promote to Production**.

---

## Fix permanently (GitHub Actions)

A workflow at `.github/workflows/vercel-deploy.yml` deploys on every push to `main`.

Add these **repository secrets** (GitHub → Settings → Secrets and variables → Actions):

| Secret | Where to find it |
|--------|------------------|
| `VERCEL_TOKEN` | https://vercel.com/account/tokens → Create Token |
| `VERCEL_ORG_ID` | Vercel project → Settings → General → **Team / Personal ID** |
| `VERCEL_PROJECT_ID` | Vercel project → Settings → General → **Project ID** |

After secrets are set, push to `main` or run **Actions → Deploy to Vercel Production → Run workflow**.

---

## Local deploy (optional)

```bash
npx vercel login
npx vercel link          # select things-to-do project
npx vercel deploy --prod
```

---

## What you should see after deploy

| URL | Expected |
|-----|----------|
| `/` | RESOLVE Overview — "Assign the problem…" |
| `/tasks` | Mission list |
| `/vault` | Vault page |
| `/merchant` | Merchant portal |

Old DEPUTY landing ("OPERATIONS CONSOLE", "Open console") should be **gone**.
