# Discover marketplace audit

Audit date: 2026-07-29
Base commit: `2135dd5e1470ec3f5c8076ea5dee97658f31e071`

## Current production data flow

### Repository intelligence

`GitHub cron or authenticated scan`
→ `scanGitHubOss`
→ `GithubOssScan` plus immutable `DiscoverRepositorySnapshot`
→ `buildDiscoverOssIntelligence`
→ `src/app/(shell)/discover/page.tsx`
→ `DiscoverCoverageIntelligence`

This is the only source loaded by the production Discover route. The client component treats missing repository selection as a global prerequisite and renders GitHub connection or installation controls before any public opportunity browsing.

### Community programs

`Community management`
→ `ResolveProgram` plus `CommunityFundStake`
→ `listFundableOpportunities`
→ legacy Capital and opportunity-board consumers

This source is not loaded by the production Discover page. The public program query runs per-program discovery metrics and authorization summaries. A production request exceeded 30 seconds. Production contains 26 active and 22 draft programs. Every active program has a mission ID.

### Outcome campaigns

`Creator campaign workflow`
→ `OutcomeCampaign` plus verified `CreatorAsset`
→ `GET /api/outcomes/campaigns`
→ `OutcomeCampaignDiscover`

This source is public but disconnected from the production Discover page. Production currently has no published outcome campaign rows.

### Communities

`COMMUNITY_CATALOG`
→ `listCommunitySummaries`
→ `GET /api/communities`
→ Communities surfaces

The production API returns the catalog, but it fills absent metrics with zero and the production Discover route does not consume it. `CommunityVitalsSnapshot` exists in the Prisma schema but is missing from the production database.

### Admin and file opportunities

No parser, canonical schema, persistence target, import report, publication query, or Discover component existed. These records could not appear because there was no executable data path.

## Exact missing-opportunity causes

1. `/discover` called only the OSS intelligence aggregator.
2. `DiscoverCoverageIntelligence` applied repository selection to the whole page.
3. Public campaigns, communities, and funding programs used separate consumers.
4. No canonical opportunity table or source-neutral query existed.
5. No admin or approved-file import pipeline existed.
6. Program discovery serialized slow per-program metrics and authorization calls.
7. Source failures were collapsed into broad degraded-source labels without showing the upstream exception or request ID.
8. Production schema drift exists. `CommunityVitalsSnapshot` is present in code and absent in production.

Vercel request logs could not be read because both the connected logs API and the available browser session lacked permission. Live response IDs were captured for the public production probes, and the code-level exception paths plus production schema were traced. The rebuild gives every source failure a generated request ID and keeps successful sources visible.

## Canonical schema

`DiscoverOpportunity` is the publication target. It contains:

- public identity, creator, community, pool, and project fields
- one controlled opportunity taxonomy
- deliverables, evidence, eligibility, and risk flags
- reward and funding state
- preferred and selected providers
- publication, deadline, and expiry dates
- source type, source ID, and source version

Supporting tables:

- `DiscoverImportRun`
- `DiscoverImportRecord`
- `DiscoverSavedItem`
- `DiscoverApplication`
- `DiscoverProviderSelection`
- `DiscoverOpportunityActivity`

All tables use RLS as defence in depth and revoke direct `anon` and `authenticated` Data API access. Reads and writes go through validated server routes.

## Route structure

- `/discover?view=opportunities`
- `/discover?view=people`
- `/discover?view=communities`
- `/discover?view=pools`
- `/discover?view=saved`
- `/opportunities/[slug]`
- `/api/discover/opportunities`
- `/api/discover/saved`
- `/api/discover/applications`
- `/api/discover/provider-selection`
- `/api/discover/funding-review`
- `/api/admin/discover/imports`
- `/api/admin/discover/imports/reprocess`

## Text wireframe

```text
App navigation

Discover header
  title and supporting copy
  Browse opportunities | Create opportunity | Create community
  real network facts, omitted when absent

Opportunities | People & Agents | Communities | Funding Pools | Saved

Search ------------------------------------------------ Sort
Desktop filters or mobile filter drawer

Source notice, only when a source failed

Opportunity card grid
  type, status, verification, published time
  creator and community
  title and summary
  real reward, funding, deadline, application count
  provider state
  View details | Save

Opportunity detail
  Overview
  Deliverables | Evidence
  Funding
  People
  Activity
  Apply | Review funding | Choose provider
```

## Migration and deployment risks

- The new tables must exist before authenticated save, apply, provider selection, or import writes can work.
- Public browsing remains available if the migration is delayed because community programs and campaigns are source-isolated.
- Existing active programs lack explicit public visibility fields. They are included because the existing application already treats active/deployed programs with a mission ID as fundable public programs. A future migration should add explicit publication state to `ResolveProgram`.
- Current program metadata is inconsistent. Optional marketplace fields are omitted rather than inferred.
- No verified `Identity` records currently exist. People discovery uses only verified contributor-registry rows and registered onchain agents.
- Funding review is intentionally a dry run. No wallet or settlement call is reachable from Discover.

## Implementation sequence

1. Canonical schema and import validation
2. Source normalisation and isolated source query
3. Public Discover shell with URL state
4. Opportunity cards and details
5. People, communities, and pools
6. Authenticated saved items and applications
7. Provider selection and dry-run funding review
8. Error, loading, responsive, accessibility, and analytics work
9. Unit, integration, Playwright, and production build verification
