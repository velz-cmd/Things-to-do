-- AlterTable
ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "notifiedAt" TIMESTAMP(3);
