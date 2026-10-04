-- W6 / Dev §23.8: verified social-proof stats need source + as-of; disable unverified placeholders.
ALTER TABLE "FooterStat" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT '';
ALTER TABLE "FooterStat" ADD COLUMN IF NOT EXISTS "asOf" TIMESTAMP(3);
ALTER TABLE "FooterStat" ADD COLUMN IF NOT EXISTS "maxAgeDays" INTEGER NOT NULL DEFAULT 90;
-- Existing placeholder strips must not publish as factual until ops supplies source/as-of.
UPDATE "FooterStat"
SET "enabled" = false
WHERE COALESCE(TRIM("source"), '') = '' OR "asOf" IS NULL;
