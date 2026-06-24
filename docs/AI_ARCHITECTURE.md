# RESOLVE AI architecture

Production-grade multi-tier stack with automatic fallbacks.

```
User → Cloudflare AI Gateway → Groq → Llama → Gemini → Supabase → Arc
```

## Production AI stack

| Role | Provider | Models | Use in RESOLVE |
|------|----------|--------|----------------|
| **Primary intelligence** | Gemini | `gemini-2.5-flash`, `gemini-2.0-flash` | Reasoning, mission evaluation, payment recommendations, treasury insights, final verdicts |
| **High-speed processing** | Groq | `llama-3.1-8b-instant`, `llama-3.3-70b-versatile` | Classification, routing, scoring, tagging, real-time structured outputs |
| **Research & analysis** | OpenRouter (Llama) | `meta-llama/llama-3.3-70b-instruct:free` | GitHub/repo analysis, contributor research, large-document processing |
| **Reliability layer** | Cloudflare AI Gateway | `resolve` gateway | Request routing, analytics, failover, rate limiting, caching |

## AI routing

| Stage | Model tier | Responsibilities |
|-------|------------|------------------|
| **Groq** | fast | Categorize requests, mission scoring, priority detection |
| **Llama** | research | Repository analysis, maintainer evaluation, funding discovery |
| **Gemini** | quality | Decision making, recommendations, treasury explanations |

### Example flow

```
User request → Groq (intent) → Llama (research) → Gemini (verdict) → Supabase + Arc payments
```

## Unity Swarm (cross-validation)

Each AI tier **reviews the previous tier's work** before the pipeline accepts output.

| Role | Agent | Action |
|------|-------|--------|
| **Producer** | Groq (fast) | Classify intent, produce structured output |
| **Validator** | Llama (research) | Approve or reject producer output with confidence + issues |
| **Arbiter** | Gemini (quality) | If disputed, correct output and reach final consensus |

Research text flows use the reverse validation path: **Llama produces → Gemini validates → Groq arbitrates**.

Set `AI_SWARM_ENABLED=false` to disable. Requires at least two configured providers.

```bash
# Classify with swarm stages in response
curl -X POST https://resolve-task.vercel.app/api/tasks/classify \
  -H "Content-Type: application/json" \
  -d '{"input":"Pay designer when logo is approved on GitHub"}'

# Direct swarm run
curl -X POST https://resolve-task.vercel.app/api/ai/swarm \
  -H "Content-Type: application/json" \
  -d '{"task":"Analyze unpaid maintainers for react repo","mode":"analyze"}'
```

## Tiers (implementation)

| Tier | Primary | Fallback | Use in RESOLVE |
|------|---------|----------|----------------|
| **fast** | Groq `llama-3.1-8b-instant` | Gemini → OpenRouter | Intent classification, escalation copy, routing |
| **research** | OpenRouter `meta-llama/llama-3.3-70b-instruct:free` | Groq → Gemini | GitHub/repo analysis, long summaries |
| **quality** | Gemini `gemini-2.5-flash` | Groq → OpenRouter | Mission plans, verdicts, treasury notes |

## Environment variables

```bash
GEMINI_API_KEY=              # Google AI Studio (free tier)
GROQ_API_KEY=                # console.groq.com (free tier)
OPENROUTER_API_KEY=          # openrouter.ai — Llama 3.3 70B free
CLOUDFLARE_ACCOUNT_ID=       # optional gateway
CLOUDFLARE_AI_GATEWAY_ID=resolve
CLOUDFLARE_AI_GATEWAY_ENABLED=true   # set false to call Groq/OpenRouter/Gemini directly
CLOUDFLARE_API_TOKEN=        # Workers AI / Gateway token
AI_SWARM_ENABLED=true        # Groq/Llama/Gemini cross-validate (default on)
```

Set on Vercel (Production + Preview). Trigger a **new deployment** after changes.

## API routes

- `GET /api/ai/chat` — provider status and tier map
- `POST /api/ai/chat` — `{ "tier": "fast|research|quality", "messages": [...] }`
- `POST /api/ai/research` — `{ "repoFullName", "prTitle", "prBody" }`
- `POST /api/tasks/classify` — rules + Unity Swarm classification
- `GET /api/ai/swarm` — swarm capabilities
- `POST /api/ai/swarm` — `{ "task", "mode": "classify|analyze|custom" }`

## Cloudflare AI Gateway

Create a gateway named `resolve` in the Cloudflare dashboard and add provider API keys there.
Set `CLOUDFLARE_AI_GATEWAY_ENABLED=true` with account ID and gateway ID to route Groq, OpenRouter, and Gemini through the gateway for logging and rate limits.

## Verification

```bash
curl https://resolve-task.vercel.app/api/config
curl -X POST https://resolve-task.vercel.app/api/tasks/classify \
  -H "Content-Type: application/json" \
  -d '{"input":"I am a founder distributing rewards to my team and community"}'
```
