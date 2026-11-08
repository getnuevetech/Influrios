-- Campaign identity, payout-vs-deliverable dates, and OAuth attempt binding.
ALTER TABLE "SocialConnection" ADD COLUMN IF NOT EXISTS "oauthRedirectUri" TEXT;
ALTER TABLE "SocialConnection" ADD COLUMN IF NOT EXISTS "oauthStartedAt" TIMESTAMP(3);

ALTER TABLE "MarketplaceBusinessRequest" ADD COLUMN IF NOT EXISTS "briefId" TEXT;
ALTER TABLE "MarketplaceBusinessRequest" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MarketplaceBusinessRequest" ADD COLUMN IF NOT EXISTS "applicationDeadline" TIMESTAMP(3);
ALTER TABLE "MarketplaceBusinessRequest" ADD COLUMN IF NOT EXISTS "deliverableSummary" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MarketplaceBusinessRequest" ADD COLUMN IF NOT EXISTS "platforms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "MarketplaceCreatorOpportunity" ADD COLUMN IF NOT EXISTS "budget" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MarketplaceCreatorOpportunity" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MarketplaceCreatorOpportunity" ADD COLUMN IF NOT EXISTS "applicationDeadline" TIMESTAMP(3);
ALTER TABLE "MarketplaceCreatorOpportunity" ADD COLUMN IF NOT EXISTS "deliverableSummary" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MarketplaceCreatorOpportunity" ADD COLUMN IF NOT EXISTS "platforms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "MarketplaceApplication" ADD COLUMN IF NOT EXISTS "briefId" TEXT;
ALTER TABLE "FundingMilestone" ADD COLUMN IF NOT EXISTS "deliverableDueAt" TIMESTAMP(3);
