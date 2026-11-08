-- Saved brand campaigns and influencer openings on the creator Opportunities page.
CREATE TABLE "SavedMarketplaceListing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedMarketplaceListing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedMarketplaceListing_userId_kind_listingId_key" ON "SavedMarketplaceListing"("userId", "kind", "listingId");

CREATE INDEX "SavedMarketplaceListing_userId_idx" ON "SavedMarketplaceListing"("userId");
