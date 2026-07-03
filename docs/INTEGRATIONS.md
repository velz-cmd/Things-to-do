# RESOLVE Integration Keys (Vercel)

Add these in **Vercel → Project → Settings → Environment Variables**.  
Apply to **Production**, **Preview**, and **Development**.

| Variable | Required | Purpose |
|----------|----------|---------|
| `GITHUB_TOKEN` | **Yes** | GitHub REST + GraphQL ingest (PRs, reviews, diffs) |
| `OPENROUTER_API_KEY` | **Yes** | Code Worker (`deepseek/deepseek-chat`) |
| `LIBRARIES_IO_API_KEY` | Recommended | Ecosystem rank + package dependents |
| `OPENALEX_API_KEY` | Recommended | Research repos — citation impact |
| `BLOCKSCOUT_API_KEY` | Recommended | Post-settlement Arc tx verification (Pro API) |
| `BLOCKSCOUT_CHAIN_ID` | Optional | Default `5042002` (Arc testnet) |
| `ALCHEMY_API_KEY` | Recommended | Arc USDC balance / RPC |
| `ETHERSCAN_API_KEY` | Optional | Etherscan V2 multichain (future) |
| `GROQ_API_KEY` | Optional | Fallback fast tier |

## Verify live

After deploy:

```bash
curl https://things-to-do-eta.vercel.app/api/integrations/health
curl https://things-to-do-eta.vercel.app/api/github/blueprint
```

All `live.*.ok` should be `true` when keys are set.

## Local

Copy keys into `.env.local` (gitignored). Never commit secrets.

```bash
npm run test:github-integrations
```

## Notes

- **Blockscout** is used **only after settlement** — never for contributor scoring.
- **OpenAlex** only enriches repos with academic citations (e.g. `langchain-ai/langchain`).
- **Libraries.io** GitHub endpoint returns ecosystem **rank**; package dependents come from linked NPM/Go packages.
