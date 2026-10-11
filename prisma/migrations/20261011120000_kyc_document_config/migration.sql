-- Admin defines document KYC requirements. Gateway KYC uses the selected payment gateway.
CREATE TABLE IF NOT EXISTS "KycSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "gatewayProviderId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KycSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "KycDocumentRequirement" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KycDocumentRequirement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CreatorKycSubmission" (
  "id" TEXT NOT NULL,
  "creatorSlug" TEXT NOT NULL,
  "creatorId" TEXT,
  "countryCode" TEXT NOT NULL DEFAULT '',
  "kycModel" TEXT NOT NULL,
  "gatewayProviderId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'submitted',
  "detailsJson" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreatorKycSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CreatorKycSubmission_creatorSlug_key" ON "CreatorKycSubmission"("creatorSlug");
CREATE INDEX IF NOT EXISTS "CreatorKycSubmission_status_idx" ON "CreatorKycSubmission"("status");

CREATE TABLE IF NOT EXISTS "CreatorKycDocument" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "requirementId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  CONSTRAINT "CreatorKycDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CreatorKycDocument_submissionId_idx" ON "CreatorKycDocument"("submissionId");

DO $$ BEGIN
  ALTER TABLE "CreatorKycDocument"
    ADD CONSTRAINT "CreatorKycDocument_submissionId_fkey"
    FOREIGN KEY ("submissionId") REFERENCES "CreatorKycSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
