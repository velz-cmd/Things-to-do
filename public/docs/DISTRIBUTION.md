# RESOLVE — Community distribution playbook

Build for communities that already exist. Ship a sidecar, plugin, or registry — not another standalone app.

## Who this is for

| Community | Integration | What you ship |
|-----------|-------------|---------------|
| **Navidrome / Subsonic** | Scrobble webhook | Sidecar at `/api/sidecar/scrobble` |
| **MusicBrainz** | Artist MBID | Payee registry at `/api/registry/musicbrainz/[mbid]` |
| **Mastodon** | ActivityPub | Campaign provider at `/api/mastodon/campaigns` |
| **Immich / Owncast** | EXIF / stream metadata | Contributor registry (existing) |

## Outreach (read this before posting)

From the [Canteen distribution thesis](https://thecanteenapp.com/analysis/2026/05/28/distribution-bootstrap-payments-founders.html):

1. **Lead with their problem** — "You run Navidrome and your artists never get paid for plays." Not "we're building for a hackathon with Arc."
2. **Look like a real product** — resolve-task.vercel.app/music solves a concrete pain. No hackathon chrome.
3. **Offer a sidecar** — upstream PR or webhook config takes an afternoon; distribution takes months if you start from zero users.

## Navidrome sidecar

When a user scrobbles a track (30s+), forward the payload:

```bash
curl -X POST https://resolve-task.vercel.app/api/sidecar/scrobble \
  -H "Content-Type: application/json" \
  -d '{
    "missionId": "YOUR_MISSION_ID",
    "username": "listener",
    "artist": "Artist Name",
    "title": "Track Title",
    "album": "Album",
    "musicbrainzId": "mbid-here-if-known",
    "durationSeconds": 245
  }'
```

Register the artist wallet first:

```bash
curl -X POST https://resolve-task.vercel.app/api/registry/musicbrainz/MBID_HERE \
  -H "Content-Type: application/json" \
  -d '{
    "missionId": "YOUR_MISSION_ID",
    "walletAddress": "0x...",
    "displayName": "Artist Name"
  }'
```

## Mastodon campaign provider

List open campaigns (for bots / pinned posts):

```
GET /api/mastodon/campaigns
GET /api/mastodon/campaigns/[id]
```

## Deadline

Lepton hackathon extended to **July 6, 2026** — enough time to pivot, ship a registry PR to Navidrome/MusicBrainz, and get real users from communities that need this.
