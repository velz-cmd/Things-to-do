ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "selectedCapitalWallet" TEXT NOT NULL DEFAULT 'app';

ALTER TABLE "User"
ADD CONSTRAINT "User_selectedCapitalWallet_check"
CHECK ("selectedCapitalWallet" IN ('app', 'connected'));
