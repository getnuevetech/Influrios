-- Phase 12.9: revision limit copied onto each milestone. A later admin edit does not rewrite it.

ALTER TABLE "MarketplaceSettings" ADD COLUMN "maxRevisions" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "FundingMilestone" ADD COLUMN "revisionLimit" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "FundingMilestone" ADD COLUMN "revisionCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "FundingMilestone" ADD COLUMN "revisionNote" TEXT NOT NULL DEFAULT '';
