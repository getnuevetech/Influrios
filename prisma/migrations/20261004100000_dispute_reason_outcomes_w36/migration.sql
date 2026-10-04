-- W3.6: Dev Addendum §13 dispute reason codes + resolution outcomes.
ALTER TABLE "DisputeReason" ADD COLUMN IF NOT EXISTS "code" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "DisputeReason_code_key" ON "DisputeReason"("code");

ALTER TABLE "MilestoneDispute" ADD COLUMN IF NOT EXISTS "reasonCode" TEXT;
ALTER TABLE "MilestoneDispute" ADD COLUMN IF NOT EXISTS "resolutionOutcome" TEXT;
