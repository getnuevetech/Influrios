-- Admin switches for paths that stay off until Payment settings turns one on.
ALTER TABLE "CollaborationLaunchGate" ADD COLUMN "crossBorderFundingEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CollaborationLaunchGate" ADD COLUMN "teamFundingEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CollaborationLaunchGate" ADD COLUMN "stagedFundingEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CollaborationLaunchGate" ADD COLUMN "automaticMilestoneApprovalEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CollaborationLaunchGate" ADD COLUMN "automaticProviderSwitchingEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CollaborationLaunchGate" ADD COLUMN "allInBudgetEntryEnabled" BOOLEAN NOT NULL DEFAULT false;
