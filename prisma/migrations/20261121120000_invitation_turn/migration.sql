-- Package 1 / P1-D1: persist whose turn an invitation is on, independent of read state.
ALTER TABLE "MarketplaceApplication" ADD COLUMN "turn" TEXT NOT NULL DEFAULT 'invitee';
ALTER TABLE "MarketplaceApplication" ADD COLUMN "interestRecorded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MarketplaceApplication" ADD COLUMN "openQuestion" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing rows from status. Before this change a question passed through RESPONDED,
-- so interest is only inferred for rows still at RESPONDED.
UPDATE "MarketplaceApplication" SET "turn" = 'business', "interestRecorded" = true WHERE "status" = 'RESPONDED';
UPDATE "MarketplaceApplication" SET "turn" = 'business', "openQuestion" = true WHERE "status" = 'NEGOTIATING';
UPDATE "MarketplaceApplication" SET "turn" = 'none'
  WHERE "status" IN ('ACCEPTED', 'COLLABORATION_DRAFTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN');
