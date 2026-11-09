-- Deal clocks. Defaults match the previous fixed values. A page load does not change them.
ALTER TABLE "MarketplaceSettings" ADD COLUMN "quoteValidHours" INTEGER NOT NULL DEFAULT 168;
ALTER TABLE "MarketplaceSettings" ADD COLUMN "unknownCommandMinutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "MarketplaceSettings" ADD COLUMN "providerCommandMaxAttempts" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "MarketplaceSettings" ADD COLUMN "disputeSlaHours" INTEGER NOT NULL DEFAULT 72;
ALTER TABLE "MarketplaceSettings" ADD COLUMN "providerHoldWarnHours" INTEGER NOT NULL DEFAULT 168;
ALTER TABLE "MarketplaceSettings" ADD COLUMN "failedPayoutBackoffHours" TEXT NOT NULL DEFAULT '1,6,24,72';
ALTER TABLE "MarketplaceSettings" ADD COLUMN "failedPayoutMaxAttempts" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "MarketplaceSettings" ADD COLUMN "staleFundingHours" INTEGER NOT NULL DEFAULT 48;
ALTER TABLE "MarketplaceSettings" ADD COLUMN "reviewDeadlineLeadHours" INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "MarketplaceSettings" ADD COLUMN "teamProposalLifeDays" INTEGER NOT NULL DEFAULT 14;
