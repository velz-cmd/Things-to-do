-- Recover real operator and GitHub-backed entities without treating legacy
-- funding ledgers as confirmed money. This migration preserves every row.

-- These exact contributor identities are the repository's legacy demo seed.
-- Quarantine them from production discovery while retaining their audit trail.
UPDATE "ContributorRegistry"
SET
  "verified" = false,
  "status" = 'quarantined_demo_fixture',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE ("platform", "platformId") IN (
  ('github', 'designer-alex'),
  ('github', 'researcher-sam'),
  ('owncast', 'stream-demo'),
  ('navidrome', 'artist-mbid-001'),
  ('navidrome', 'artist-mbid-002'),
  ('immich', 'photo-jane'),
  ('immich', 'photo-marcus'),
  ('mastodon', 'writer@fosstodon.org'),
  ('jellyfin', 'filmmaker-01'),
  ('generic', 'moderator-kai')
);

-- Active GitHub programs were created by authenticated operators through a
-- real community install and Mission. Attach deterministic legacy provenance,
-- but do not claim current policy, treasury, or financial readiness.
UPDATE "ResolveProgram" AS program
SET
  "metadataJson" = (
    COALESCE(NULLIF(program."metadataJson", '')::jsonb, '{}'::jsonb)
    || jsonb_build_object(
      'canonicalOwnerId', program."userId",
      'canonicalInstallId', program."installId",
      'provenance', COALESCE(NULLIF(COALESCE(NULLIF(program."metadataJson", '')::jsonb, '{}'::jsonb) ->> 'provenance', ''), 'operator_created'),
      'publicationStatus', COALESCE(NULLIF(COALESCE(NULLIF(program."metadataJson", '')::jsonb, '{}'::jsonb) ->> 'publicationStatus', ''), 'legacy_active'),
      'publicationVersion', COALESCE(NULLIF(COALESCE(NULLIF(program."metadataJson", '')::jsonb, '{}'::jsonb) ->> 'publicationVersion', ''), 'legacy-recovery-v1'),
      'policyStatus', COALESCE(NULLIF(COALESCE(NULLIF(program."metadataJson", '')::jsonb, '{}'::jsonb) ->> 'policyStatus', ''), 'legacy_configured'),
      'sourceConnector', 'github',
      'entityVisibility', 'public',
      'financialReadiness', 'setup_required',
      'recoveryVersion', '2026-08-01'
    )
  )::text,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "ResolveCommunityInstall" AS install, "User" AS owner
WHERE program."installId" = install.id
  AND program."userId" = owner.id
  AND program.status IN ('active', 'deployed')
  AND program."missionId" IS NOT NULL
  AND install.status = 'active'
  AND (owner."githubId" IS NOT NULL OR owner."githubUsername" IS NOT NULL)
  AND COALESCE(NULLIF(program."rulesJson", '')::jsonb, '{}'::jsonb) ->> 'connectorId' = 'github'
  AND COALESCE(COALESCE(NULLIF(program."metadataJson", '')::jsonb, '{}'::jsonb) ->> 'visibility', '') <> 'private'
  AND lower(COALESCE(COALESCE(NULLIF(program."metadataJson", '')::jsonb, '{}'::jsonb) ->> 'fixture', 'false')) NOT IN ('true', '1', 'yes')
  AND lower(COALESCE(COALESCE(NULLIF(program."metadataJson", '')::jsonb, '{}'::jsonb) ->> 'isDemo', 'false')) NOT IN ('true', '1', 'yes');

-- Keep unavailable adapters in the operator console with a truthful blocker.
-- They do not become public or financially executable.
UPDATE "ResolveProgram" AS program
SET
  "metadataJson" = (
    COALESCE(NULLIF(program."metadataJson", '')::jsonb, '{}'::jsonb)
    || jsonb_build_object(
      'adapterStatus', 'unsupported',
      'publicationStatus', COALESCE(NULLIF(COALESCE(NULLIF(program."metadataJson", '')::jsonb, '{}'::jsonb) ->> 'publicationStatus', ''), 'operator_review_required'),
      'financialReadiness', 'blocked_unsupported_adapter',
      'recoveryVersion', '2026-08-01'
    )
  )::text,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE program.status IN ('active', 'deployed')
  AND COALESCE(NULLIF(program."rulesJson", '')::jsonb, '{}'::jsonb) ->> 'connectorId' IS DISTINCT FROM 'github';
