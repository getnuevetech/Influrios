-- Phase 12.12: a signed partial refund lowers the milestone.
-- The original amount stays. The rest can be released by a later webhook.
-- Turning partial refunds off does not cancel a request already recorded.

ALTER TABLE "MarketplaceSettings" ADD COLUMN "partialRefundsEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "FundingMilestone" ADD COLUMN "refundedCents" INTEGER NOT NULL DEFAULT 0;
