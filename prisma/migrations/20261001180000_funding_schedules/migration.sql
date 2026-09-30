-- Phase 12.6: staged and recurring prefunds. Each tranche stays unfunded until its own webhook.

ALTER TABLE "MarketplaceSettings" ADD COLUMN "stagedFundingEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MarketplaceSettings" ADD COLUMN "recurringFundingEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MarketplaceSettings" ADD COLUMN "maxStages" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "MarketplaceSettings" ADD COLUMN "recurringIntervalDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "MarketplaceSettings" ADD COLUMN "maxRecurrences" INTEGER NOT NULL DEFAULT 6;

ALTER TABLE "CollaborationFunding" ADD COLUMN "scheduleId" TEXT;
ALTER TABLE "CollaborationFunding" ADD COLUMN "scheduleKind" TEXT NOT NULL DEFAULT 'once';
ALTER TABLE "CollaborationFunding" ADD COLUMN "trancheIndex" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CollaborationFunding" ADD COLUMN "trancheCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "CollaborationFunding" ADD COLUMN "intervalDays" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "CollaborationFunding_scheduleId_trancheIndex_key" ON "CollaborationFunding"("scheduleId", "trancheIndex");
CREATE INDEX "CollaborationFunding_scheduleId_idx" ON "CollaborationFunding"("scheduleId");
