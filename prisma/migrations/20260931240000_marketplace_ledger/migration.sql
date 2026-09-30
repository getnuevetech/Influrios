-- Phase 12.3: marketplace prefund, milestone workflow, and provider-held ledger.

CREATE TABLE "MarketplaceSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "reviewWindowHours" INTEGER NOT NULL DEFAULT 72,
    "templatesSeeded" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketplaceSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CollaborationJurisdiction" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "protectedPaymentsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "escrowTermAllowed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CollaborationJurisdiction_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "MilestoneTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "shareBps" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MilestoneTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CollaborationFunding" (
    "id" TEXT NOT NULL,
    "jurisdictionCode" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "creatorSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "grossCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "feeSnapshotJson" JSONB NOT NULL,
    "serviceLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'awaiting_provider',
    "providerCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CollaborationFunding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FundingMilestone" (
    "id" TEXT NOT NULL,
    "fundingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewWindowHours" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "autoApproveAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FundingMilestone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "fundingId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "kind" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CollaborationFunding_creatorSlug_status_idx" ON "CollaborationFunding"("creatorSlug", "status");
CREATE INDEX "CollaborationFunding_status_idx" ON "CollaborationFunding"("status");
CREATE INDEX "FundingMilestone_fundingId_status_idx" ON "FundingMilestone"("fundingId", "status");
CREATE UNIQUE INDEX "LedgerEntry_provider_eventId_kind_key" ON "LedgerEntry"("provider", "eventId", "kind");
CREATE INDEX "LedgerEntry_fundingId_idx" ON "LedgerEntry"("fundingId");

ALTER TABLE "FundingMilestone" ADD CONSTRAINT "FundingMilestone_fundingId_fkey" FOREIGN KEY ("fundingId") REFERENCES "CollaborationFunding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_fundingId_fkey" FOREIGN KEY ("fundingId") REFERENCES "CollaborationFunding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "FundingMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
