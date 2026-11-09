ALTER TABLE "CollaborationFunding" ADD COLUMN IF NOT EXISTS "routeSnapshotJson" JSONB;

CREATE TABLE IF NOT EXISTS "MilestoneSubmission" (
  "id" TEXT NOT NULL,
  "fundingId" TEXT NOT NULL,
  "milestoneId" TEXT NOT NULL,
  "creatorSlug" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "note" TEXT NOT NULL,
  "linkUrl" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'submitted',
  "reviewNote" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MilestoneSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MilestoneSubmission_milestoneId_creatorSlug_version_key" ON "MilestoneSubmission"("milestoneId", "creatorSlug", "version");
CREATE INDEX IF NOT EXISTS "MilestoneSubmission_fundingId_createdAt_idx" ON "MilestoneSubmission"("fundingId", "createdAt");

ALTER TABLE "MilestoneSubmission" ADD CONSTRAINT "MilestoneSubmission_fundingId_fkey" FOREIGN KEY ("fundingId") REFERENCES "CollaborationFunding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MilestoneSubmission" ADD CONSTRAINT "MilestoneSubmission_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "FundingMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
