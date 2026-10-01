-- Phase 12.10: evidence cap copied onto each dispute. A later admin edit does not rewrite it.

ALTER TABLE "MarketplaceSettings" ADD COLUMN "maxEvidence" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "MilestoneDispute" ADD COLUMN "evidenceLimit" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "DisputeNote" ADD COLUMN "url" TEXT NOT NULL DEFAULT '';
