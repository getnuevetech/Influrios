-- Phase 12.5: frozen deal attribution and repeat of a confirmed prefund.

ALTER TABLE "MarketplaceSettings" ADD COLUMN "attributionWindowDays" INTEGER NOT NULL DEFAULT 90;
ALTER TABLE "MarketplaceSettings" ADD COLUMN "repeatMinGrossCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MarketplaceSettings" ADD COLUMN "sourcesSeeded" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "AttributionSource" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttributionSource_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CollaborationFunding" ADD COLUMN "attributionLabel" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CollaborationFunding" ADD COLUMN "repeatOfId" TEXT;

CREATE INDEX "CollaborationFunding_repeatOfId_idx" ON "CollaborationFunding"("repeatOfId");

ALTER TABLE "CollaborationFunding" ADD CONSTRAINT "CollaborationFunding_repeatOfId_fkey" FOREIGN KEY ("repeatOfId") REFERENCES "CollaborationFunding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
