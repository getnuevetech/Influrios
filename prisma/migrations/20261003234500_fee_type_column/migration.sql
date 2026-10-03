-- Distinct fee types (Product Addendum §5) on rules + admin snapshots.
ALTER TABLE "CollaborationFeeRule" ADD COLUMN IF NOT EXISTS "feeType" TEXT NOT NULL DEFAULT 'collaboration';
ALTER TABLE "CollaborationFeeSnapshot" ADD COLUMN IF NOT EXISTS "feeType" TEXT NOT NULL DEFAULT 'collaboration';

UPDATE "CollaborationFeeRule" SET "feeType" = 'platform_service' WHERE "serviceLevel" = 'discovery' AND "feeType" = 'collaboration';
UPDATE "CollaborationFeeRule" SET "feeType" = 'managed_intro' WHERE "serviceLevel" = 'managed_intro' AND "feeType" = 'collaboration';
UPDATE "CollaborationFeeRule" SET "feeType" = 'managed_campaign' WHERE "serviceLevel" = 'managed_campaign' AND "feeType" = 'collaboration';
