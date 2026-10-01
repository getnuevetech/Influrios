-- Admin switches for risk limits, signing envelopes, and the agency workspace.
-- Risk controls and financial reports can be turned off without deleting ledger rows.
-- Agency seats stay empty until an admin turns that switch on.

ALTER TABLE "MarketplaceSettings" ADD COLUMN "riskControlsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MarketplaceSettings" ADD COLUMN "maxOpenDisputes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SignatureRequest" ADD COLUMN "externalId" TEXT NOT NULL DEFAULT '';

CREATE TABLE "AgencyWorkspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'AGENCY',
    "notes" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyWorkspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgencyRosterMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "creatorSlug" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'talent',
    "retainerLabel" TEXT NOT NULL DEFAULT 'Project',
    "notes" TEXT NOT NULL DEFAULT '',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyRosterMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgencyCampaign" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'briefing',
    "specialty" TEXT NOT NULL,
    "budgetLabel" TEXT NOT NULL,
    "creatorSlugs" JSONB NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgencyPortfolio" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "leftSlug" TEXT NOT NULL,
    "rightSlug" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT '',
    "metricsJson" JSONB NOT NULL,
    "campaignId" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyPortfolio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgencySeat" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencySeat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgencyRosterMember_workspaceId_creatorSlug_key" ON "AgencyRosterMember"("workspaceId", "creatorSlug");
CREATE INDEX "AgencyCampaign_workspaceId_status_idx" ON "AgencyCampaign"("workspaceId", "status");
CREATE INDEX "AgencyPortfolio_workspaceId_published_idx" ON "AgencyPortfolio"("workspaceId", "published");
CREATE UNIQUE INDEX "AgencySeat_workspaceId_email_key" ON "AgencySeat"("workspaceId", "email");

ALTER TABLE "AgencyRosterMember" ADD CONSTRAINT "AgencyRosterMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "AgencyWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyCampaign" ADD CONSTRAINT "AgencyCampaign_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "AgencyWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencyPortfolio" ADD CONSTRAINT "AgencyPortfolio_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "AgencyWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgencySeat" ADD CONSTRAINT "AgencySeat_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "AgencyWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
