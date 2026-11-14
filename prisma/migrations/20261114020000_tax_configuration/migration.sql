-- Tax settings are per subject. Existing draft and active rows stay in place.
ALTER TABLE "TaxPolicyVersion" ADD COLUMN "appliesTo" TEXT NOT NULL DEFAULT '';
ALTER TABLE "TaxPolicyVersion" ADD COLUMN "countryCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "TaxPolicyVersion" ADD COLUMN "regionCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "TaxPolicyVersion" ADD COLUMN "environment" TEXT NOT NULL DEFAULT 'sandbox';
ALTER TABLE "TaxPolicyVersion" ADD COLUMN "providerCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "TaxPolicyVersion" ADD COLUMN "providerAccountId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "TaxPolicyVersion" ADD COLUMN "calculationMethod" TEXT NOT NULL DEFAULT '';
ALTER TABLE "TaxPolicyVersion" ADD COLUMN "taxCategory" TEXT NOT NULL DEFAULT '';
ALTER TABLE "TaxPolicyVersion" ADD COLUMN "registrationStatus" TEXT NOT NULL DEFAULT 'not_synced';
ALTER TABLE "TaxPolicyVersion" ADD COLUMN "filingArrangement" TEXT NOT NULL DEFAULT '';
ALTER TABLE "TaxPolicyVersion" ADD COLUMN "effectiveTo" TIMESTAMP(3);
ALTER TABLE "TaxPolicyVersion" ADD COLUMN "linkedIds" TEXT NOT NULL DEFAULT '';

CREATE INDEX "TaxPolicyVersion_appliesTo_status_idx" ON "TaxPolicyVersion"("appliesTo", "status");

CREATE TABLE "TaxPreviewRun" (
  "id" TEXT NOT NULL,
  "policyName" TEXT NOT NULL DEFAULT '',
  "appliesTo" TEXT NOT NULL DEFAULT '',
  "subjectId" TEXT NOT NULL DEFAULT '',
  "amountCents" INTEGER NOT NULL,
  "taxCents" INTEGER,
  "totalCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "countryCode" TEXT NOT NULL DEFAULT '',
  "regionCode" TEXT NOT NULL DEFAULT '',
  "postalCode" TEXT NOT NULL DEFAULT '',
  "ok" BOOLEAN NOT NULL,
  "reason" TEXT NOT NULL DEFAULT '',
  "correction" TEXT NOT NULL DEFAULT '',
  "liableEntity" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaxPreviewRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaxPreviewRun_appliesTo_createdAt_idx" ON "TaxPreviewRun"("appliesTo", "createdAt");
