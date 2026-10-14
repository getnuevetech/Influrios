-- Contact person on BusinessProfile is reference-only (not login credentials).
ALTER TABLE "BusinessProfile" ADD COLUMN IF NOT EXISTS "contactName" TEXT;
ALTER TABLE "BusinessProfile" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE "BusinessProfile" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
