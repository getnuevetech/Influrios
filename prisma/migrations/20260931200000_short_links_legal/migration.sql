-- inflr.me short links and the versioned legal ledger. Historical rows are not deleted.

CREATE TABLE "ShortLinkDomain" (
    "id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "fallback" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShortLinkDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShortLinkDomain_hostname_key" ON "ShortLinkDomain"("hostname");

CREATE TABLE "ShortLinkSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "canonicalOrigin" TEXT NOT NULL,
    "allowedHosts" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShortLinkSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReservedSlug" (
    "slug" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReservedSlug_pkey" PRIMARY KEY ("slug")
);

CREATE TABLE "ShortLink" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT,
    "slug" TEXT NOT NULL,
    "destinationKind" TEXT NOT NULL DEFAULT 'profile',
    "destination" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "dynamic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShortLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShortLink_slug_key" ON "ShortLink"("slug");

CREATE TABLE "ShortLinkAlias" (
    "id" TEXT NOT NULL,
    "shortLinkId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "redirect" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShortLinkAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShortLinkAlias_slug_key" ON "ShortLinkAlias"("slug");

CREATE TABLE "QrIdentity" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "shortLinkId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QrIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QrIdentity_token_key" ON "QrIdentity"("token");

CREATE TABLE "ShortLinkEvent" (
    "id" TEXT NOT NULL,
    "shortLinkId" TEXT,
    "eventType" TEXT NOT NULL,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShortLinkEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShortLinkEvent_shortLinkId_createdAt_idx" ON "ShortLinkEvent"("shortLinkId", "createdAt");

CREATE TABLE "ShortLinkAbuseCase" (
    "id" TEXT NOT NULL,
    "shortLinkId" TEXT,
    "slug" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShortLinkAbuseCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LegalDocument" (
    "id" TEXT NOT NULL,
    "documentKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "jurisdiction" TEXT NOT NULL DEFAULT 'global',
    "roleScope" TEXT NOT NULL DEFAULT 'all',
    "featureTrigger" TEXT NOT NULL,
    "requiresAcceptance" BOOLEAN NOT NULL DEFAULT false,
    "requiresReacceptance" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgementOnly" BOOLEAN NOT NULL DEFAULT false,
    "publishedStatus" TEXT NOT NULL DEFAULT 'draft',
    "bodyText" TEXT NOT NULL,
    "documentHash" TEXT NOT NULL,
    "supersedesId" TEXT,
    "category" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegalDocument_documentKey_version_key" ON "LegalDocument"("documentKey", "version");
CREATE INDEX "LegalDocument_featureTrigger_publishedStatus_idx" ON "LegalDocument"("featureTrigger", "publishedStatus");
CREATE INDEX "LegalDocument_category_publishedStatus_idx" ON "LegalDocument"("category", "publishedStatus");

CREATE TABLE "LegalAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "subjectKey" TEXT,
    "documentId" TEXT NOT NULL,
    "documentKey" TEXT NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "documentHash" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptanceType" TEXT NOT NULL,
    "acceptanceContext" TEXT NOT NULL,
    "userRole" TEXT,
    "country" TEXT,
    "ip" TEXT,
    "sessionMeta" TEXT,
    CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LegalAcceptance_userId_documentKey_idx" ON "LegalAcceptance"("userId", "documentKey");
CREATE INDEX "LegalAcceptance_subjectKey_documentKey_idx" ON "LegalAcceptance"("subjectKey", "documentKey");
CREATE INDEX "LegalAcceptance_documentId_idx" ON "LegalAcceptance"("documentId");

ALTER TABLE "ShortLink" ADD CONSTRAINT "ShortLink_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShortLinkAlias" ADD CONSTRAINT "ShortLinkAlias_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QrIdentity" ADD CONSTRAINT "QrIdentity_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShortLinkEvent" ADD CONSTRAINT "ShortLinkEvent_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShortLinkAbuseCase" ADD CONSTRAINT "ShortLinkAbuseCase_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LegalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Plus launch default now includes a custom short-link slug. Admins can turn it off in plan entitlements.
UPDATE "PlanFeatureEntitlement" AS feature
SET "enabled" = true
FROM "EntitlementPlan" AS plan
WHERE feature."planId" = plan."id"
  AND plan."code" = 'PLUS'
  AND feature."featureKey" = 'card.custom_slug.enabled';
