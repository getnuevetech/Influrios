-- INFLR.me phase 4: campaign links, NFC identities, scheduled destinations.

CREATE TABLE "NfcIdentity" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "shortLinkId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NfcIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NfcIdentity_token_key" ON "NfcIdentity"("token");

ALTER TABLE "NfcIdentity" ADD CONSTRAINT "NfcIdentity_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ShortLinkSchedule" (
    "id" TEXT NOT NULL,
    "shortLinkId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "destinationKind" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShortLinkSchedule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShortLinkSchedule_status_startsAt_idx" ON "ShortLinkSchedule"("status", "startsAt");

ALTER TABLE "ShortLinkSchedule" ADD CONSTRAINT "ShortLinkSchedule_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CampaignLink" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "shortLinkId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "destinationKind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CampaignLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampaignLink_code_key" ON "CampaignLink"("code");
CREATE INDEX "CampaignLink_creatorId_status_idx" ON "CampaignLink"("creatorId", "status");

ALTER TABLE "CampaignLink" ADD CONSTRAINT "CampaignLink_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignLink" ADD CONSTRAINT "CampaignLink_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
