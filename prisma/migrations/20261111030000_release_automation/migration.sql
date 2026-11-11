-- Payout scheduling stays automatic. These switches decide the admin approval and the provider send.
ALTER TABLE "CollaborationLaunchGate" ADD COLUMN "automaticReleaseApprovalEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CollaborationLaunchGate" ADD COLUMN "automaticProviderReleaseEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FundingMilestone" ADD COLUMN "releaseApprovedAt" TIMESTAMP(3);
