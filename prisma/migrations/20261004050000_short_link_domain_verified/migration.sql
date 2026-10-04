-- W5: ops-attested short-link domain verification (INFLR.me Spec §16 / §20.24).
ALTER TABLE "ShortLinkDomain" ADD COLUMN IF NOT EXISTS "verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShortLinkDomain" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "ShortLinkDomain" ADD COLUMN IF NOT EXISTS "verifiedBy" TEXT;

-- Existing active domains stay operational after migrate (launch hosts already live).
UPDATE "ShortLinkDomain"
SET "verified" = true,
    "verifiedAt" = COALESCE("verifiedAt", CURRENT_TIMESTAMP)
WHERE "active" = true AND "verified" = false;
