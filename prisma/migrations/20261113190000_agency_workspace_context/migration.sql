-- Explicit agency clients and per-influencer links to canonical collaboration records.
CREATE TABLE "AgencyClient" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgencyClient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgencyClient_workspaceId_name_key" ON "AgencyClient"("workspaceId", "name");
CREATE INDEX "AgencyClient_workspaceId_idx" ON "AgencyClient"("workspaceId");

ALTER TABLE "AgencyClient"
  ADD CONSTRAINT "AgencyClient_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "AgencyWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgencyCampaign" ADD COLUMN "clientId" TEXT;

CREATE INDEX "AgencyCampaign_clientId_idx" ON "AgencyCampaign"("clientId");

ALTER TABLE "AgencyCampaign"
  ADD CONSTRAINT "AgencyCampaign_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "AgencyClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AgencyCampaignLink" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "creatorSlug" TEXT NOT NULL,
  "collaborationId" TEXT,
  "contractDocumentId" TEXT,
  "fundingId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgencyCampaignLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgencyCampaignLink_campaignId_creatorSlug_key" ON "AgencyCampaignLink"("campaignId", "creatorSlug");
CREATE INDEX "AgencyCampaignLink_workspaceId_idx" ON "AgencyCampaignLink"("workspaceId");
CREATE INDEX "AgencyCampaignLink_collaborationId_idx" ON "AgencyCampaignLink"("collaborationId");

ALTER TABLE "AgencyCampaignLink"
  ADD CONSTRAINT "AgencyCampaignLink_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "AgencyCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
