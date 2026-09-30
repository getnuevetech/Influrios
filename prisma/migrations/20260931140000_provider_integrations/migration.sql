-- Admin-managed AI pipelines, country payment gateways, and collaboration signing.

CREATE TABLE "IntegrationProvider" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "baseUrl" TEXT,
    "publicKey" TEXT,
    "secretCipher" TEXT,
    "webhookCipher" TEXT,
    "extraJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IntegrationProvider_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegrationProvider_kind_code_key" ON "IntegrationProvider"("kind", "code");

CREATE TABLE "PaymentCountryRoute" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentCountryRoute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentCountryRoute_countryCode_key" ON "PaymentCountryRoute"("countryCode");

CREATE TABLE "AiFunctionRoute" (
    "functionKey" TEXT NOT NULL,
    "providerId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiFunctionRoute_pkey" PRIMARY KEY ("functionKey")
);

CREATE TABLE "SignatureRequest" (
    "id" TEXT NOT NULL,
    "collaborationId" TEXT NOT NULL,
    "providerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "title" TEXT NOT NULL,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SignatureRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SignatureRequest_collaborationId_idx" ON "SignatureRequest"("collaborationId");

ALTER TABLE "PaymentCountryRoute" ADD CONSTRAINT "PaymentCountryRoute_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "IntegrationProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiFunctionRoute" ADD CONSTRAINT "AiFunctionRoute_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "IntegrationProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_collaborationId_fkey" FOREIGN KEY ("collaborationId") REFERENCES "Collaboration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SignatureRequest" ADD CONSTRAINT "SignatureRequest_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "IntegrationProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
