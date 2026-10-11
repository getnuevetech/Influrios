-- A corridor KYC type is gateway or government_id. Older free-text values are cleared until admin chooses.
ALTER TABLE "CountryActivationCorridor" ALTER COLUMN "kycModel" SET DEFAULT '';
UPDATE "CountryActivationCorridor"
SET "kycModel" = ''
WHERE "kycModel" NOT IN ('gateway', 'government_id');

ALTER TABLE "CorridorCountryGroup" ADD COLUMN IF NOT EXISTS "kycModel" TEXT NOT NULL DEFAULT '';
