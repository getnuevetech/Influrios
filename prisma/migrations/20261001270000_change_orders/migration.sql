-- Phase 12.13: a change order amends the gross before the provider confirms it.
-- The limit is copied onto the prefund. The earlier fee snapshot stays on the change order.
-- Turning change orders off does not undo an amendment already recorded.

ALTER TABLE "MarketplaceSettings" ADD COLUMN "changeOrdersEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MarketplaceSettings" ADD COLUMN "maxChangeOrders" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "CollaborationFunding" ADD COLUMN "changeOrderLimit" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "CollaborationFunding" ADD COLUMN "changeOrderCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "FundingChangeOrder" (
    "id" TEXT NOT NULL,
    "fundingId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "previousGrossCents" INTEGER NOT NULL,
    "nextGrossCents" INTEGER NOT NULL,
    "previousUsdCents" INTEGER NOT NULL,
    "nextUsdCents" INTEGER NOT NULL,
    "previousFeeSnapshotJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundingChangeOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FundingChangeOrder_fundingId_idx" ON "FundingChangeOrder"("fundingId");

ALTER TABLE "FundingChangeOrder" ADD CONSTRAINT "FundingChangeOrder_fundingId_fkey" FOREIGN KEY ("fundingId") REFERENCES "CollaborationFunding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
