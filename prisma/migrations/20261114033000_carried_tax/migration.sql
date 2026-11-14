-- A settlement stores carried original tax. Null is not a valid zero.
ALTER TABLE "MilestoneSettlementV4" ADD COLUMN "taxReason" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MilestoneSettlementV4" ALTER COLUMN "taxCents" DROP NOT NULL;
ALTER TABLE "MilestoneSettlementV4" ALTER COLUMN "taxCents" DROP DEFAULT;
UPDATE "MilestoneSettlementV4" SET "taxCents" = NULL WHERE "taxReason" = '' AND "taxCents" = 0;
