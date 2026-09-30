-- Phase 12.4: milestone disputes and cancellation of an unconfirmed prefund.

ALTER TABLE "MarketplaceSettings" ADD COLUMN "cancelUnconfirmed" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MarketplaceSettings" ADD COLUMN "reasonsSeeded" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "DisputeReason" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DisputeReason_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MilestoneDispute" (
    "id" TEXT NOT NULL,
    "fundingId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "openedBy" TEXT NOT NULL,
    "reasonLabel" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "requestedRefundCents" INTEGER,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MilestoneDispute_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DisputeNote" (
    "id" TEXT NOT NULL,
    "disputeId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DisputeNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MilestoneDispute_fundingId_status_idx" ON "MilestoneDispute"("fundingId", "status");
CREATE INDEX "MilestoneDispute_milestoneId_status_idx" ON "MilestoneDispute"("milestoneId", "status");
CREATE INDEX "DisputeNote_disputeId_idx" ON "DisputeNote"("disputeId");

ALTER TABLE "MilestoneDispute" ADD CONSTRAINT "MilestoneDispute_fundingId_fkey" FOREIGN KEY ("fundingId") REFERENCES "CollaborationFunding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MilestoneDispute" ADD CONSTRAINT "MilestoneDispute_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "FundingMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisputeNote" ADD CONSTRAINT "DisputeNote_disputeId_fkey" FOREIGN KEY ("disputeId") REFERENCES "MilestoneDispute"("id") ON DELETE CASCADE ON UPDATE CASCADE;
