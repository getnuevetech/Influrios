-- New inquiries start as lead_created. Existing rows keep the status already stored.
ALTER TABLE "BusinessInquiry" ALTER COLUMN "status" SET DEFAULT 'lead_created';

CREATE TABLE IF NOT EXISTS "SponsoredPlacement" (
  "id" TEXT NOT NULL,
  "creatorSlug" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SponsoredPlacement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SponsoredPlacement_creatorSlug_key" ON "SponsoredPlacement"("creatorSlug");
