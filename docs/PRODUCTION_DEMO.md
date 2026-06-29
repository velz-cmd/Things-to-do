# Production demo (Lepton / external users)

Honest checklist for a real external-user demo on `https://resolve-task.vercel.app`.

## Quick verify

```bash
APP_URL=https://resolve-task.vercel.app npx tsx scripts/verify-production-demo.ts
```

With operator cron (bootstrap + artist registry seed):

```bash
APP_URL=https://resolve-task.vercel.app CRON_SECRET=... npx tsx scripts/verify-production-demo.ts
```

In-app: **Settings → Lepton / external-user demo** (live checklist).

API: `GET /api/status/demo-readiness`

## Environment checklist

| Need | Vercel env | Why |
|------|------------|-----|
| Production honesty | `DEPUTY_DEMO_MODE=false` | No fake card credits or synthetic Gmail |
| ListenBrainz (users) | `MUSICBRAINZ_CLIENT_ID`, `MUSICBRAINZ_CLIENT_SECRET` | Profile → Connect ListenBrainz |
| OpenAlex (research) | `OPENALEX_API_KEY` or `OPENALEX_EMAIL` | Citation toll sensor (optional key) |
| Navidrome scrobbles | `NAVIDROME_URL` + credentials **or** `NAVIDROME_SYNC_SECRET` + bridge | Music ingress |
| Artist payees | `PRODUCTION_ARTIST_REGISTRY` (optional JSON) | Deploy resolves artist → wallet |
| Treasury | `ARC_CLIENT_WALLET_ADDRESS` funded on Arc testnet | On-chain memo payouts |
| Claims | GitHub OAuth in Supabase | `/claim` sign-in for creators |
| Cron | `CRON_SECRET` | Bootstrap, sensor tick, registry seed |

## Operator bootstrap (one shot)

```bash
curl -X POST https://resolve-task.vercel.app/api/cron/bootstrap-sensors \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"
```

Installs React, Linux, Open Research, **Independent Music**, Navidrome communities; activates programs; seeds production artist registry; syncs GitHub/OpenAlex/QF sensors.

Seed artist wallets only:

```bash
curl -X POST https://resolve-task.vercel.app/api/registry/seed-production \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Navidrome bridge (self-hosted)

On your Navidrome host (not Vercel):

```bash
npm install better-sqlite3
NAVIDROME_DB_PATH=/path/to/navidrome.db \
RESOLVE_SYNC_URL=https://resolve-task.vercel.app/api/connectors/navidrome/sync \
NAVIDROME_SYNC_SECRET=your-secret \
NAVIDROME_PROGRAM_MISSION_ID=mission-from-community-page \
npx tsx scripts/navidrome-bridge.ts
```

Cron example (every 5 min):

```cron
*/5 * * * * cd /path/to/resolve && NAVIDROME_DB_PATH=... npx tsx scripts/navidrome-bridge.ts
```

## External-user music path

1. Sign in → **Profile** → Connect ListenBrainz
2. **Discover** → Install Independent Music
3. **Profile** → Link artist wallet (MusicBrainz search or alias)
4. Listen to music (or run Navidrome bridge)
5. `POST /api/connectors/sensors/sync` (or wait for cron)
6. **Capital** → Fund program → Deploy
7. Creator visits **/claim** → Collect earnings

## External-user bounty path

1. `POST /api/cron/bootstrap-sensors` (operator)
2. Fund docs program on React/Linux community
3. Merge a docs PR (or wait for GitHub sensor)
4. Deploy → creator **/claim**

## Fund treasury

1. Copy `ARC_CLIENT_WALLET_ADDRESS` from Vercel
2. Fund on [Arc testnet faucet](https://faucet.circle.com)
3. Confirm: `GET /api/treasury/arc-readiness`

## Traction proof

Invite one external tester:

- GitHub sign-in on `/claim`, or
- ListenBrainz connect on `/profile`

Readiness panel tracks linked external identities automatically.
