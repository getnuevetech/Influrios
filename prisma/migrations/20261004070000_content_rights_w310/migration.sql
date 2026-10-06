-- W3.10: Content rights state separate from milestone acceptance (Product Addendum §13).
ALTER TABLE "FundingMilestone"
  ADD COLUMN IF NOT EXISTS "rightsStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "FundingMilestone"
  ADD COLUMN IF NOT EXISTS "rightsActivateOn" TEXT NOT NULL DEFAULT 'release';
ALTER TABLE "FundingMilestone"
  ADD COLUMN IF NOT EXISTS "rightsActivatedAt" TIMESTAMP(3);
