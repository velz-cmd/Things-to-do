-- Phase 5 Release Slice 15: atomic duplicate-payment protection.
--
-- The Release Slice 12 stale-state guard in /api/wallet/send is a real,
-- valuable check, but it is not atomic on its own: query coverage, see
-- nothing, proceed to create an ActionRun is a check-then-act sequence.
-- Two concurrent requests for the same real obligation (two browser tabs,
-- two users racing the same work reward) can both pass the check before
-- either one's ActionRun exists, and both then proceed to send real money.
--
-- This closes that race with a genuine database-level constraint, not an
-- application-level lock (which would not hold across concurrent
-- serverless invocations). A PARTIAL unique index - unique only while a
-- row's state is "submitting" or "pending_external" - is the correct
-- shape: it blocks two SIMULTANEOUSLY ACTIVE claims on the same real
-- obligation, but does not permanently reserve the obligationId forever,
-- so a rejected/failed attempt correctly frees it for a legitimate retry
-- (the row's state moves to "rejected"/"completed", which the partial
-- index's WHERE clause no longer covers).
--
-- Prisma's schema DSL has no WHERE-clause (partial/filtered) unique index
-- support, so this constraint exists ONLY in this raw migration SQL and is
-- intentionally not represented as a `@@unique` in schema.prisma - the
-- `obligationId` column itself is declared there (a normal, fully-Prisma-
-- managed column); only the partial uniqueness is hand-written here,
-- matching this repository's existing precedent for constraints Prisma's
-- schema language cannot express.
--
-- ActionRun.obligationId is additive and nullable - every pre-existing row
-- has NULL here and is entirely unaffected (a NULL obligationId never
-- participates in a unique index by SQL's own null-distinctness rules,
-- and this index also explicitly excludes NULL for clarity).

ALTER TABLE "ActionRun" ADD COLUMN IF NOT EXISTS "obligationId" TEXT;

CREATE INDEX IF NOT EXISTS "ActionRun_obligationId_idx" ON "ActionRun"("obligationId");

CREATE UNIQUE INDEX IF NOT EXISTS "ActionRun_active_obligation_unique"
  ON "ActionRun"("obligationId")
  WHERE "obligationId" IS NOT NULL
    AND "state" IN ('submitting', 'pending_external');
