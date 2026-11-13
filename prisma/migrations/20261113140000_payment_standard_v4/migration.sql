-- Payment standard v4.1 records. Existing funded agreements keep their original rows.
ALTER TABLE "EntitlementPlan" ADD COLUMN "taxCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "EntitlementPlan" ADD COLUMN "taxBehavior" TEXT NOT NULL DEFAULT '';
ALTER TABLE "EntitlementPlan" ADD COLUMN "taxPolicyId" TEXT NOT NULL DEFAULT '';

ALTER TABLE "CollaborationFeeRule" ADD COLUMN "taxPolicyId" TEXT NOT NULL DEFAULT '';

CREATE TABLE "PaymentRouteVersion" (
  "id" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "providerCode" TEXT NOT NULL,
  "providerImplementationVersion" TEXT NOT NULL DEFAULT 'stripe-us-4.1',
  "status" TEXT NOT NULL DEFAULT 'draft',
  "newCollectionsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "releasesEnabled" BOOLEAN NOT NULL DEFAULT false,
  "roleMappingJson" JSONB NOT NULL,
  "capabilitiesJson" JSONB NOT NULL,
  "taxPolicyId" TEXT NOT NULL DEFAULT '',
  "approvalEvidence" TEXT NOT NULL DEFAULT '',
  "allocatedFundsApproved" BOOLEAN NOT NULL DEFAULT false,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentRouteVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentRouteVersion_countryCode_environment_version_key" ON "PaymentRouteVersion"("countryCode", "environment", "version");
CREATE INDEX "PaymentRouteVersion_countryCode_status_idx" ON "PaymentRouteVersion"("countryCode", "status");

CREATE TABLE "TaxPolicyVersion" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "liableEntity" TEXT NOT NULL,
  "treatment" TEXT NOT NULL,
  "inclusive" BOOLEAN NOT NULL DEFAULT false,
  "classification" TEXT NOT NULL DEFAULT '',
  "filingOwner" TEXT NOT NULL DEFAULT '',
  "jurisdiction" TEXT NOT NULL DEFAULT '',
  "customerRole" TEXT NOT NULL,
  "rateBps" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaxPolicyVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaxPolicyVersion_name_version_key" ON "TaxPolicyVersion"("name", "version");
CREATE INDEX "TaxPolicyVersion_status_customerRole_idx" ON "TaxPolicyVersion"("status", "customerRole");

CREATE TABLE "PaymentVerificationTask" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "checkKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'not_started',
  "providerRef" TEXT NOT NULL DEFAULT '',
  "ownerLabel" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentVerificationTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentVerificationTask_userId_role_checkKey_key" ON "PaymentVerificationTask"("userId", "role", "checkKey");
CREATE INDEX "PaymentVerificationTask_status_idx" ON "PaymentVerificationTask"("status");
ALTER TABLE "PaymentVerificationTask" ADD CONSTRAINT "PaymentVerificationTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MilestoneSettlementV4" (
  "id" TEXT NOT NULL,
  "fundingId" TEXT NOT NULL,
  "milestoneId" TEXT NOT NULL,
  "agreementVersion" INTEGER NOT NULL DEFAULT 1,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "currency" TEXT NOT NULL,
  "grossCents" INTEGER NOT NULL,
  "businessFeeCents" INTEGER NOT NULL,
  "influencerFeeCents" INTEGER NOT NULL,
  "influencerNetCents" INTEGER NOT NULL,
  "operationsFeeCents" INTEGER NOT NULL,
  "taxCents" INTEGER NOT NULL DEFAULT 0,
  "idempotencyKey" TEXT NOT NULL,
  "payoutState" TEXT NOT NULL DEFAULT 'queued',
  "transferRef" TEXT NOT NULL DEFAULT '',
  "payoutRef" TEXT NOT NULL DEFAULT '',
  "restrictedFeeCents" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MilestoneSettlementV4_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MilestoneSettlementV4_idempotencyKey_key" ON "MilestoneSettlementV4"("idempotencyKey");
CREATE UNIQUE INDEX "MilestoneSettlementV4_milestoneId_agreementVersion_revision_key" ON "MilestoneSettlementV4"("milestoneId", "agreementVersion", "revision");
CREATE INDEX "MilestoneSettlementV4_fundingId_status_idx" ON "MilestoneSettlementV4"("fundingId", "status");

CREATE TABLE "SettlementLegV4" (
  "id" TEXT NOT NULL,
  "settlementId" TEXT NOT NULL,
  "leg" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'planned',
  "amountCents" INTEGER NOT NULL,
  "instructionKey" TEXT NOT NULL DEFAULT '',
  "providerRef" TEXT NOT NULL DEFAULT '',
  "evidence" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SettlementLegV4_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SettlementLegV4_settlementId_leg_key" ON "SettlementLegV4"("settlementId", "leg");
ALTER TABLE "SettlementLegV4" ADD CONSTRAINT "SettlementLegV4_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "MilestoneSettlementV4"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PaymentJournalLine" (
  "id" TEXT NOT NULL,
  "fundingId" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "account" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "eventKey" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentJournalLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentJournalLine_fundingId_eventKey_account_direction_key" ON "PaymentJournalLine"("fundingId", "eventKey", "account", "direction");
CREATE INDEX "PaymentJournalLine_fundingId_idx" ON "PaymentJournalLine"("fundingId");

CREATE TABLE "ReconciliationCaseV4" (
  "id" TEXT NOT NULL,
  "fundingId" TEXT NOT NULL,
  "settlementId" TEXT NOT NULL DEFAULT '',
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "reason" TEXT NOT NULL,
  "restrictedFeeCents" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReconciliationCaseV4_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReconciliationCaseV4_status_kind_idx" ON "ReconciliationCaseV4"("status", "kind");
