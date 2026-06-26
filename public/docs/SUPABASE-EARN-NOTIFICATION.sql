-- Add earn-notification tracking to Authorization Ledger (run in Supabase SQL editor)
ALTER TABLE "PaymentAuthorization"
  ADD COLUMN IF NOT EXISTS "notifiedAt" TIMESTAMP(3);
