-- Phase G: business briefs, shortlist, inquiries, managed opt-in, and the intro queue.

CREATE TABLE "BusinessWorkspace" (
    "id" TEXT NOT NULL DEFAULT 'demo-business',
    "name" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'BUSINESS_PRO',
    "industry" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BusinessWorkspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessBrief" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "budget" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessBrief_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessShortlistItem" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "creatorSlug" TEXT NOT NULL,
    "note" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessShortlistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessInquiry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "briefId" TEXT,
    "creatorSlug" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BusinessInquiry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreatorManagedOptIn" (
    "creatorSlug" TEXT NOT NULL,
    "openToManaged" BOOLEAN NOT NULL DEFAULT false,
    "targetingNotes" TEXT NOT NULL DEFAULT '',
    "niches" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreatorManagedOptIn_pkey" PRIMARY KEY ("creatorSlug")
);

CREATE TABLE "ManagedIntro" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "creatorSlug" TEXT NOT NULL,
    "briefTitle" TEXT NOT NULL,
    "briefId" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "feeExpected" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ManagedIntro_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManagedIntroEvent" (
    "id" TEXT NOT NULL,
    "introId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManagedIntroEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManagedMatchRequest" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "introId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ManagedMatchRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BusinessBrief_workspaceId_idx" ON "BusinessBrief"("workspaceId");
CREATE UNIQUE INDEX "BusinessShortlistItem_workspaceId_creatorSlug_key" ON "BusinessShortlistItem"("workspaceId", "creatorSlug");
CREATE INDEX "BusinessInquiry_workspaceId_idx" ON "BusinessInquiry"("workspaceId");
CREATE INDEX "ManagedIntroEvent_introId_idx" ON "ManagedIntroEvent"("introId");
CREATE UNIQUE INDEX "ManagedMatchRequest_introId_key" ON "ManagedMatchRequest"("introId");
CREATE INDEX "ManagedMatchRequest_status_idx" ON "ManagedMatchRequest"("status");

ALTER TABLE "BusinessBrief" ADD CONSTRAINT "BusinessBrief_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "BusinessWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessShortlistItem" ADD CONSTRAINT "BusinessShortlistItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "BusinessWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessInquiry" ADD CONSTRAINT "BusinessInquiry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "BusinessWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessInquiry" ADD CONSTRAINT "BusinessInquiry_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "BusinessBrief"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManagedIntroEvent" ADD CONSTRAINT "ManagedIntroEvent_introId_fkey" FOREIGN KEY ("introId") REFERENCES "ManagedIntro"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagedMatchRequest" ADD CONSTRAINT "ManagedMatchRequest_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "BusinessWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagedMatchRequest" ADD CONSTRAINT "ManagedMatchRequest_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "BusinessBrief"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagedMatchRequest" ADD CONSTRAINT "ManagedMatchRequest_introId_fkey" FOREIGN KEY ("introId") REFERENCES "ManagedIntro"("id") ON DELETE SET NULL ON UPDATE CASCADE;
