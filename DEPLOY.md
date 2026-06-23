# Deploy RESOLVE (non-technical guide)

Your code **is saved on GitHub**. Vercel just has not built the newest version yet.

Live site is still the **old** DEPUTY page. New code has **RESOLVE** (sidebar: Overview · Tasks · Vault).

---

## Easiest fix — 4 clicks in Vercel

You are already on the right page (**Deployments**).

1. Click the blue **「Create Deployment」** button (top right of the deployments list)
2. Make sure **Branch** says `main`
3. Make sure **Environment** says **Production**
4. Click **Deploy** and wait ~2 minutes until it says **Ready**

Then open https://resolve-task.vercel.app — you should see **RESOLVE** on the left, not the old DEPUTY landing.

**Do not** click Redeploy on the old row (`4a7829a`) — that only rebuilds the old version.

---

## Even easier next time — Deploy Hook (paste URL to Cursor)

So the AI can deploy for you with one command:

1. Vercel → project **things-to-do** → **Settings** → **Git** → scroll to **Deploy Hooks**
2. Click **Create Hook**
   - Name: `cursor-deploy`
   - Branch: `main`
3. Copy the hook URL (looks like `https://api.vercel.com/v1/integrations/deploy/...`)
4. Paste that URL in chat and say **「deploy now」**

The agent can trigger production deploys without you clicking anything.

---

## Why the AI cannot deploy Vercel for you yet

- **Vercel is not connected** to this Cursor agent (MCP shows error)
- **GitHub Actions** needs a Vercel token you have not added yet
- Pushes to GitHub **stopped triggering** Vercel after commit `4a7829a`

### Optional: connect Vercel to Cursor (one-time)

In **Cursor** → **Settings** → **MCP** → **Vercel** → **Authenticate**

After that, ask the agent to deploy again.

---

## How to know it worked

| Check | Old (wrong) | New (correct) |
|-------|-------------|---------------|
| https://resolve-task.vercel.app/tasks | 404 error | Tasks page loads |
| Left sidebar | No sidebar / DEPUTY landing | **RESOLVE** + Overview / Tasks / Vault |
| Title | DEPUTY | RESOLVE |

---

## Still stuck?

In Vercel → **Settings** → **Git** → click **Disconnect** then **Connect** your GitHub repo again. That fixes webhooks that stop firing.

Then do **Create Deployment** from `main` again.
