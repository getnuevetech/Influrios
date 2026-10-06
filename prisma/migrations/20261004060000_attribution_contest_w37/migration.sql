-- W3.7: Attribution status/expiry on funding + contested pre-existing claims.
ALTER TABLE "CollaborationFunding"
  ADD COLUMN IF NOT EXISTS "attributionStatus" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "CollaborationFunding"
  ADD COLUMN IF NOT EXISTS "attributionExpiresAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "AttributionClaim" (
  "id" TEXT NOT NULL,
  "businessName" TEXT NOT NULL,
  "creatorSlug" TEXT NOT NULL,
  "fundingId" TEXT,
  "claimType" TEXT NOT NULL DEFAULT 'PRE_EXISTING_RELATIONSHIP',
  "status" TEXT NOT NULL DEFAULT 'open',
  "evidence" TEXT NOT NULL DEFAULT '',
  "adminNote" TEXT NOT NULL DEFAULT '',
  "filedBy" TEXT NOT NULL DEFAULT 'business',
  "resolvedBy" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttributionClaim_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AttributionClaim_status_createdAt_idx" ON "AttributionClaim"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "AttributionClaim_businessName_creatorSlug_idx" ON "AttributionClaim"("businessName", "creatorSlug");
CREATE INDEX IF NOT EXISTS "AttributionClaim_fundingId_idx" ON "AttributionClaim"("fundingId");
