-- Plan codes are text so admin can add, remove, and recreate plans without a schema change.

ALTER TABLE "User" ALTER COLUMN "planTier" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "planTier" TYPE TEXT USING "planTier"::text;
ALTER TABLE "User" ALTER COLUMN "planTier" SET DEFAULT 'STARTER';

ALTER TABLE "Creator" ALTER COLUMN "planTier" DROP DEFAULT;
ALTER TABLE "Creator" ALTER COLUMN "planTier" TYPE TEXT USING "planTier"::text;
ALTER TABLE "Creator" ALTER COLUMN "planTier" SET DEFAULT 'STARTER';

ALTER TABLE "EntitlementPlan" ALTER COLUMN "code" TYPE TEXT USING "code"::text;

ALTER TABLE "EntitlementOverride" ALTER COLUMN "planCode" TYPE TEXT USING "planCode"::text;

ALTER TABLE "EntitlementPlan" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'creator';
ALTER TABLE "EntitlementPlan" ADD COLUMN "amountCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EntitlementPlan" ADD COLUMN "priceLabel" TEXT NOT NULL DEFAULT '';
ALTER TABLE "EntitlementPlan" ADD COLUMN "stripePriceId" TEXT;
ALTER TABLE "EntitlementPlan" ADD COLUMN "publicListing" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EntitlementPlan" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

UPDATE "EntitlementPlan" SET "audience" = 'business' WHERE "code" IN ('BUSINESS_FREE', 'BUSINESS_PRO', 'AGENCY');
UPDATE "EntitlementPlan" SET "priceLabel" = 'Free', "publicListing" = true, "sortOrder" = 0 WHERE "code" = 'STARTER';
UPDATE "EntitlementPlan" SET "amountCents" = 1900, "priceLabel" = '$19/mo', "publicListing" = true, "sortOrder" = 1 WHERE "code" = 'PLUS';
UPDATE "EntitlementPlan" SET "amountCents" = 2900, "priceLabel" = '$29/mo', "publicListing" = true, "sortOrder" = 2 WHERE "code" = 'PRO';
UPDATE "EntitlementPlan" SET "priceLabel" = 'Free', "publicListing" = true, "sortOrder" = 10 WHERE "code" = 'BUSINESS_FREE';
UPDATE "EntitlementPlan" SET "amountCents" = 9900, "priceLabel" = '$99/mo', "publicListing" = true, "sortOrder" = 11 WHERE "code" = 'BUSINESS_PRO';
UPDATE "EntitlementPlan" SET "amountCents" = 34900, "priceLabel" = '$349/mo', "publicListing" = true, "sortOrder" = 12 WHERE "code" = 'AGENCY';

DROP TYPE "PlanTier";

CREATE TABLE "FaqEntry" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FaqEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FaqEntry_key_key" ON "FaqEntry"("key");
CREATE INDEX "FaqEntry_audience_published_sortOrder_idx" ON "FaqEntry"("audience", "published", "sortOrder");
