-- Dev §16 / §8: scheduled milestone release tracking.
ALTER TABLE "FundingMilestone" ADD COLUMN IF NOT EXISTS "releaseScheduledAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "FundingMilestone_status_releaseScheduledAt_idx"
  ON "FundingMilestone"("status", "releaseScheduledAt");
