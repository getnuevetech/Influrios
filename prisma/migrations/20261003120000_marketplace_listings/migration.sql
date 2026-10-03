-- CreateTable
CREATE TABLE "MarketplaceBusinessRequest" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "budget" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "summary" TEXT NOT NULL,
    "lookingFor" TEXT NOT NULL,
    "logoUrl" TEXT,
    "imageUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'published',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceBusinessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceCreatorOpportunity" (
    "id" TEXT NOT NULL,
    "creatorSlug" TEXT NOT NULL,
    "lookingFor" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "purpose" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'published',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceCreatorOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceMatchRecord" (
    "id" TEXT NOT NULL,
    "matchType" TEXT NOT NULL DEFAULT 'CREATOR_CREATOR',
    "partyASlug" TEXT NOT NULL,
    "partyBSlug" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "breakdownJson" JSONB NOT NULL,
    "reasonsJson" JSONB NOT NULL,
    "why" TEXT NOT NULL,
    "specialtyHits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "modelVersion" TEXT NOT NULL DEFAULT 'rules-v1',
    "expiresAt" TIMESTAMP(3),
    "convertedCollaborationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceMatchRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceMatchSave" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "userId" TEXT,
    "guestKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceMatchSave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceApplication" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "businessRequestId" TEXT,
    "opportunityId" TEXT,
    "fromUserId" TEXT,
    "fromSlug" TEXT,
    "toSlug" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceApplicationEvent" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "actorUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceApplicationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketplaceBusinessRequest_status_sortOrder_idx" ON "MarketplaceBusinessRequest"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "MarketplaceCreatorOpportunity_status_sortOrder_idx" ON "MarketplaceCreatorOpportunity"("status", "sortOrder");

-- CreateIndex
CREATE INDEX "MarketplaceCreatorOpportunity_creatorSlug_idx" ON "MarketplaceCreatorOpportunity"("creatorSlug");

-- CreateIndex
CREATE INDEX "MarketplaceMatchRecord_score_idx" ON "MarketplaceMatchRecord"("score");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceMatchRecord_partyASlug_partyBSlug_matchType_key" ON "MarketplaceMatchRecord"("partyASlug", "partyBSlug", "matchType");

-- CreateIndex
CREATE INDEX "MarketplaceMatchSave_matchId_idx" ON "MarketplaceMatchSave"("matchId");

-- CreateIndex
CREATE INDEX "MarketplaceMatchSave_userId_idx" ON "MarketplaceMatchSave"("userId");

-- CreateIndex
CREATE INDEX "MarketplaceMatchSave_guestKey_idx" ON "MarketplaceMatchSave"("guestKey");

-- CreateIndex
CREATE INDEX "MarketplaceApplication_kind_status_idx" ON "MarketplaceApplication"("kind", "status");

-- CreateIndex
CREATE INDEX "MarketplaceApplication_businessRequestId_idx" ON "MarketplaceApplication"("businessRequestId");

-- CreateIndex
CREATE INDEX "MarketplaceApplication_opportunityId_idx" ON "MarketplaceApplication"("opportunityId");

-- CreateIndex
CREATE INDEX "MarketplaceApplicationEvent_applicationId_idx" ON "MarketplaceApplicationEvent"("applicationId");

-- AddForeignKey
ALTER TABLE "MarketplaceMatchSave" ADD CONSTRAINT "MarketplaceMatchSave_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "MarketplaceMatchRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceApplication" ADD CONSTRAINT "MarketplaceApplication_businessRequestId_fkey" FOREIGN KEY ("businessRequestId") REFERENCES "MarketplaceBusinessRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceApplication" ADD CONSTRAINT "MarketplaceApplication_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "MarketplaceCreatorOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceApplicationEvent" ADD CONSTRAINT "MarketplaceApplicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MarketplaceApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

