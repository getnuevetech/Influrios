-- Dev §16: failed payout retry tracking on milestones.
ALTER TABLE "FundingMilestone" ADD COLUMN IF NOT EXISTS "payoutFailedAt" TIMESTAMP(3);
ALTER TABLE "FundingMilestone" ADD COLUMN IF NOT EXISTS "payoutRetryCount" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "FundingMilestone_status_payoutFailedAt_idx"
  ON "FundingMilestone"("status", "payoutFailedAt");
