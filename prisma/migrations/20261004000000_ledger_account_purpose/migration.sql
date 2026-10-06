-- Collab OS P4: tag ledger movements with logical account purposes.
ALTER TABLE "LedgerEntry" ADD COLUMN IF NOT EXISTS "accountPurpose" TEXT NOT NULL DEFAULT '';
