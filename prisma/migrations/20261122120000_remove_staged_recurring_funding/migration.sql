-- Staged (instalment) and recurring funding are removed. Every collaboration is funded once, in full,
-- and milestones release that budget. No screen ever started a staged or recurring deal, so only the
-- unused switches are dropped. Funding rows keep their schedule columns (all "once").
ALTER TABLE "MarketplaceSettings" DROP COLUMN IF EXISTS "stagedFundingEnabled";
ALTER TABLE "MarketplaceSettings" DROP COLUMN IF EXISTS "recurringFundingEnabled";
ALTER TABLE "MarketplaceSettings" DROP COLUMN IF EXISTS "maxStages";
ALTER TABLE "MarketplaceSettings" DROP COLUMN IF EXISTS "recurringIntervalDays";
ALTER TABLE "MarketplaceSettings" DROP COLUMN IF EXISTS "maxRecurrences";
ALTER TABLE "CollaborationLaunchGate" DROP COLUMN IF EXISTS "stagedFundingEnabled";
ALTER TABLE "CollaborationJurisdiction" DROP COLUMN IF EXISTS "stagedPrefundingEnabled";
ALTER TABLE "CollaborationJurisdiction" DROP COLUMN IF EXISTS "recurringFundingEnabled";

-- The recurring sweep job no longer exists.
DELETE FROM "Job" WHERE "kind" = 'recurring_cycle_sweep' AND "status" IN ('queued', 'pending');
-- Fee rules can no longer target the removed STAGED mode. No staged deal ever existed, so these rules never applied.
UPDATE "CollaborationFeeRule" SET "active" = false WHERE "fundingMode" = 'STAGED';
