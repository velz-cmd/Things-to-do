# Discover empty-state root cause

Audit date: 2026-08-01

Starting production commit: `c2a5cc14f6c7f385e1b097e95ae4d02e2f364e65`

## Production baseline

| Source | Persisted records | Public result before recovery | Classification |
| --- | ---: | ---: | --- |
| Active `ResolveProgram` | 25 | 0 | 11 GitHub-backed operator programs, 14 programs on unavailable adapters |
| Active community installs | 17 | 0 in My Communities | Genuine account-owned operator state |
| GitHub-linked operator users | 3 | 0 reliable People cards | Genuine Supabase users with GitHub IDs |
| Contributor registry | 16 | 13 eligible under the old query | 10 exact demo seeds, 3 genuine user GitHub identities, 2 demo-default artists, 1 malformed claim identity |
| GitHub App source connections | 1 connected | Generic connect action | Genuine connection reused across tabs |
| Repository snapshots | 2 | 0 Verified Work | Genuine snapshots for one repository, current activity record count is zero |
| GitHub OSS scan | 1 | 0 Verified Work | Genuine persisted scan, current accepted activity record count is zero |
| Canonical evidence | 0 | 0 | No accepted-work evidence can be invented |
| Funding intents, settlement batches, chain transactions, receipts | 0 each | 0 Outcomes | Correctly empty and still authoritative |

## Exact regression

Commit `d72aafa22a2b1c66c97a4bd5fecb4dc867fee2cf` made program visibility depend on all of these financial and publication requirements:

- `publicationStatus: approved`
- provenance in the public allow-list
- `policyStatus: active`
- a valid Arc treasury address
- a publication version
- an active or deployed program with a Mission

Production had 25 active programs, but none had the newly introduced metadata fields. The query therefore filtered every program before normalisation. The empty array was cached under the `programs:v2` key. People still read a legacy registry whose verified flag included known demo seed rows, so the integrity fix avoided showing them by making direct support unavailable, but it did not build a truthful replacement from real GitHub-linked users. My Communities was also removed as a Discover view and replaced by a generic link.

The model collapsed two different questions:

1. Is this a genuine persisted entity with a real owner and supported source?
2. Can money execute now with a verified policy, treasury, payout route, and settlement rail?

That collapse caused valid entities to disappear when only their financial setup was incomplete.

## Recovery decision

Entity visibility now requires a real authenticated owner, active install, active or deployed lifecycle, Mission reference, supported GitHub adapter, and no private, fixture, or demo marker. Financial execution remains a separate gate and still requires publication approval, active policy, treasury, live Arc, explicit approval, submission, confirmation, and receipt.

The cache namespace is moved to `v3`, so a degraded or previously empty `v2` value cannot hold the repaired page at zero.

## Records restored and retained

- Eleven GitHub-backed active programs are restored as real setup-incomplete Pool entities.
- Three GitHub-linked operators are restored to People with exact payout setup state.
- Seventeen account-owned installs remain available to My Communities through the signed-in read model.
- Repository snapshots remain the source for Verified Work. No work card is created when the snapshot contains no accepted record.
- Confirmed Outcomes still require both a confirmed chain transaction and a receipt.

## Records kept out of public execution

- Ten exact `DEMO_CONTRIBUTORS` seeds are quarantined by their platform and platform ID.
- Fourteen active programs using Navidrome, Jellyfin, OpenAlex, Crossref, or OpenCollective remain visible only in operator management with an unsupported-adapter blocker.
- Legacy `CommunityFundStake` values remain pending or provenance-unavailable. They are not shown as confirmed deposits.
- Artist defaults and unsupported media identities are not projected into public People.
- No outcome, payout, receipt, or Arc success is synthesized.

