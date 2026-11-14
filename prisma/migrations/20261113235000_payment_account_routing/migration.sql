-- Canonical provider accounts and route proof. Existing funded agreements keep their rows.
ALTER TABLE "PaymentRouteVersion" ADD COLUMN "topology" TEXT NOT NULL DEFAULT 'unavailable';
ALTER TABLE "PaymentRouteVersion" ADD COLUMN "proofState" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "PaymentRouteVersion" ADD COLUMN "operationsWithdrawalEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PaymentRouteVersion" ADD COLUMN "bankPayoutControl" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PaymentRouteVersion" ADD COLUMN "connectionId" TEXT NOT NULL DEFAULT '';

ALTER TABLE "MilestoneSettlementV4" ADD COLUMN "commandKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MilestoneSettlementV4" ADD COLUMN "sourceAccountId" TEXT NOT NULL DEFAULT '';

ALTER TABLE "SettlementLegV4" ADD COLUMN "sourceAccountId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SettlementLegV4" ADD COLUMN "destinationAccountId" TEXT NOT NULL DEFAULT '';

CREATE TABLE "ProviderConnection" (
  "id" TEXT NOT NULL,
  "providerCode" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "platformAccountId" TEXT NOT NULL DEFAULT '',
  "credentialRef" TEXT NOT NULL DEFAULT '',
  "apiVersion" TEXT NOT NULL DEFAULT '2025-02-24.acacia',
  "webhookEndpointRef" TEXT NOT NULL DEFAULT '',
  "health" TEXT NOT NULL DEFAULT 'unknown',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderConnection_provider_env_platform_key" ON "ProviderConnection"("providerCode", "environment", "platformAccountId");
CREATE INDEX "ProviderConnection_providerCode_health_idx" ON "ProviderConnection"("providerCode", "health");

CREATE TABLE "ProviderAccount" (
  "id" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "externalAccountId" TEXT NOT NULL DEFAULT '',
  "financialAccountId" TEXT NOT NULL DEFAULT '',
  "accountKind" TEXT NOT NULL DEFAULT 'connected',
  "parentPlatformId" TEXT NOT NULL DEFAULT '',
  "legalOwnerRef" TEXT NOT NULL DEFAULT '',
  "country" TEXT NOT NULL DEFAULT '',
  "currencies" TEXT NOT NULL DEFAULT '',
  "capabilityEvidence" JSONB,
  "payoutSchedule" TEXT NOT NULL DEFAULT '',
  "environment" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderAccount_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProviderAccount_connectionId_idx" ON "ProviderAccount"("connectionId");
CREATE INDEX "ProviderAccount_externalAccountId_idx" ON "ProviderAccount"("externalAccountId");

CREATE TABLE "PaymentRoleBinding" (
  "id" TEXT NOT NULL,
  "routeVersionId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL DEFAULT '',
  "financialAccountId" TEXT NOT NULL DEFAULT '',
  "operationsJson" JSONB NOT NULL,
  "balanceScope" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "PaymentRoleBinding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentRoleBinding_routeVersionId_role_key" ON "PaymentRoleBinding"("routeVersionId", "role");

CREATE TABLE "ProviderEventInbox" (
  "id" TEXT NOT NULL,
  "providerCode" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "accountContext" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "livemode" BOOLEAN NOT NULL,
  "payloadHash" TEXT NOT NULL DEFAULT '',
  "fundingId" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'received',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderEventInbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderEventInbox_context_event_key" ON "ProviderEventInbox"("providerCode", "environment", "accountContext", "eventId");
CREATE INDEX "ProviderEventInbox_fundingId_idx" ON "ProviderEventInbox"("fundingId");

ALTER TABLE "ProviderAccount" ADD CONSTRAINT "ProviderAccount_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentRoleBinding" ADD CONSTRAINT "PaymentRoleBinding_routeVersionId_fkey" FOREIGN KEY ("routeVersionId") REFERENCES "PaymentRouteVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
