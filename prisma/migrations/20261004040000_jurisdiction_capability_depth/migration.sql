-- W3.3: Jurisdiction payment capability depth (Dev Addendum §6 / §24).
ALTER TABLE "CollaborationJurisdiction"
  ADD COLUMN IF NOT EXISTS "fullPrefundingEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CollaborationJurisdiction"
  ADD COLUMN IF NOT EXISTS "stagedPrefundingEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CollaborationJurisdiction"
  ADD COLUMN IF NOT EXISTS "recurringFundingEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CollaborationJurisdiction"
  ADD COLUMN IF NOT EXISTS "managedIntroductionEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CollaborationJurisdiction"
  ADD COLUMN IF NOT EXISTS "managedNegotiationEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CollaborationJurisdiction"
  ADD COLUMN IF NOT EXISTS "approvedProviderIds" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "CollaborationJurisdiction"
  ADD COLUMN IF NOT EXISTS "legalReviewStatus" TEXT NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "CollaborationJurisdiction"
  ADD COLUMN IF NOT EXISTS "capabilityNotes" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CollaborationJurisdiction"
  ADD COLUMN IF NOT EXISTS "capabilitiesEffectiveFrom" TIMESTAMP(3);
ALTER TABLE "CollaborationJurisdiction"
  ADD COLUMN IF NOT EXISTS "capabilitiesEffectiveTo" TIMESTAMP(3);

-- Existing protected markets stay operational; restricted markets stay pending review.
UPDATE "CollaborationJurisdiction"
SET "legalReviewStatus" = 'APPROVED'
WHERE "protectedPaymentsEnabled" = true;

UPDATE "CollaborationJurisdiction"
SET "legalReviewStatus" = 'PENDING',
    "fullPrefundingEnabled" = false
WHERE "protectedPaymentsEnabled" = false;
