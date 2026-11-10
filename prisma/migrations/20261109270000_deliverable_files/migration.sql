CREATE TABLE "MilestoneFile" (
    "id" TEXT NOT NULL,
    "fundingId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "submissionId" TEXT,
    "audience" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilestoneFile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MilestoneFile_milestoneId_createdAt_idx" ON "MilestoneFile"("milestoneId", "createdAt");
CREATE INDEX "MilestoneFile_submissionId_idx" ON "MilestoneFile"("submissionId");

ALTER TABLE "MilestoneFile" ADD CONSTRAINT "MilestoneFile_fundingId_fkey" FOREIGN KEY ("fundingId") REFERENCES "CollaborationFunding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MilestoneFile" ADD CONSTRAINT "MilestoneFile_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "FundingMilestone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MilestoneFile" ADD CONSTRAINT "MilestoneFile_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "MilestoneSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
