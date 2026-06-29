# Community connectors — what to set up

RESOLVE uses **program templates** on **communities**. Profile connectors unlock auto-install + sensor sync.

## Already live (you configured these)

| Track | Profile connector | Vercel env | OAuth / callback |
|-------|-------------------|------------|------------------|
| **Music** | ListenBrainz (MusicBrainz OAuth) | `MUSICBRAINZ_CLIENT_ID`, `MUSICBRAINZ_CLIENT_SECRET` | `https://resolve-task.vercel.app/api/connectors/listenbrainz/callback` |
| **Music** | Navidrome (optional URL + user + pass on Profile) | — | No OAuth — credentials on Profile |
| **OSS** | GitHub (`Resolve connector` OAuth app) | `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET` | `https://resolve-task.vercel.app/api/connectors/github/callback` |
| **OSS** | GitHub API (optional, rate limits) | `GITHUB_TOKEN` | — |
| **Research** | OpenAlex sensor | `OPENALEX_API_KEY` (optional) | No user OAuth — public API |

**Database (all tracks):** `DATABASE_URL` = Supabase transaction pooler `:6543` with `?pgbouncer=true&connection_limit=1`

---

## Phase 3 tracks → communities

| Track | Event | Auto-installed when |
|-------|-------|---------------------|
| Music | `scrobble.play` | ListenBrainz or Navidrome connected |
| OSS | `docs.merged` / `security.advisory` | GitHub connected |
| Research | `citation.verified` | GitHub or ListenBrainz connected (Open Research) |

**Sync:** Profile → **Sync sensors** or `POST /api/connectors/sensors/sync`

**Status:** `GET /api/connectors/phase3/status`

---

## New community: Jellyfin (recommended)

We chose **Jellyfin** over PeerTube and Owncast:

| Platform | Userbase | Why |
|----------|----------|-----|
| **Jellyfin** | Largest open self-hosted media stack (millions of installs) | Same sidecar pattern as Navidrome; `video.watch` already in ledger |
| PeerTube | Large fediverse, federated | Harder attribution across instances; better as phase 2 |
| Owncast | Niche (live only) | Small userbase; `stream.view` only |

### Jellyfin APIs RESOLVE uses

1. **Authenticate** — `POST /Users/AuthenticateByName`  
   Body: `{ "Username", "Pw" }` → returns `AccessToken`

2. **Now playing** — `GET /Sessions?activeWithinSeconds=120&nowPlaying=true`  
   Header: `Authorization: MediaBrowser Token="<token>"`

3. **Program event** — `video.watch` (min 60s watch) → `video-royalties` template

Docs: https://api.jellyfin.org/

### What you need to do for Jellyfin

1. **Merge** Jellyfin community PR (catalog + connector code)
2. **Run** `npx prisma db push` on production DB (adds `jellyfin*` user fields)
3. On Profile → connect Jellyfin server URL + username + password (stores access token)
4. Auto-installs **Jellyfin** community + `video-royalties` program
5. **Sync sensors** — polls sessions → ledger authorizations

### Optional later: Jellyfin webhook plugin

For installs that cannot expose API to Vercel, run a small bridge on the Jellyfin host (like `scripts/navidrome-bridge.ts`) posting to:

`POST /api/connectors/jellyfin/sync`

---

## PeerTube (phase 2 — not selected)

If you add PeerTube later:

- **API:** `GET /api/v1/videos`, OAuth2 on each instance
- **Event:** `video.watch` or ActivityPub `View`
- **Env:** per-instance `PEERTUBE_CLIENT_ID` / secret
- **Challenge:** federated creators — payee = channel across instances

## Owncast (not recommended first)

- Webhook on stream start/stop only
- Small creator base vs Jellyfin

---

## Checklist for any new community

1. Add entry to `COMMUNITY_CATALOG` in `src/lib/communities/catalog.ts`
2. Add `PROGRAM_TEMPLATES` row with `eventType` + `connectorId`
3. Add connector to `CONNECTOR_CATALOG` in `src/lib/connectors/types.ts`
4. Implement sensor or bridge (`src/lib/sensors/` or `src/lib/connectors/`)
5. Wire `auto-install.ts` when profile identity connects
6. Add Phase 3 track row in `phase3-tracks.ts` (optional)
7. Profile connect UI or env-based operator sync
8. Vercel env vars + redeploy
