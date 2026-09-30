-- Phase 12.7: admin FX rates, marketplace provider routing, and revenue-share lines.

ALTER TABLE "MarketplaceSettings" ADD COLUMN "fxSeeded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MarketplaceSettings" ADD COLUMN "sharesSeeded" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "CollaborationJurisdiction" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "CollaborationJurisdiction" ADD COLUMN "providerCode" TEXT NOT NULL DEFAULT 'primary';

UPDATE "CollaborationJurisdiction" SET "currency" = 'GBP' WHERE "code" = 'GB';
UPDATE "CollaborationJurisdiction" SET "currency" = 'NGN' WHERE "code" = 'NG';

ALTER TABLE "CollaborationFunding" ADD COLUMN "fxSnapshotJson" JSONB;
ALTER TABLE "CollaborationFunding" ADD COLUMN "shareSnapshotJson" JSONB;

ALTER TABLE "LedgerEntry" ADD COLUMN "party" TEXT NOT NULL DEFAULT '';
DROP INDEX "LedgerEntry_provider_eventId_kind_key";
CREATE UNIQUE INDEX "LedgerEntry_provider_eventId_kind_party_key" ON "LedgerEntry"("provider", "eventId", "kind", "party");

CREATE TABLE "FxRate" (
    "currency" TEXT NOT NULL,
    "minorPerUsd" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("currency")
);

CREATE TABLE "RevenueParty" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "shareBps" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RevenueParty_pkey" PRIMARY KEY ("id")
);
