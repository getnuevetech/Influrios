-- Original screen-written signature ink for in-app (native) signing.
ALTER TABLE "ContractParty" ADD COLUMN IF NOT EXISTS "signatureInkJson" TEXT NOT NULL DEFAULT '';
