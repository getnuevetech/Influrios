-- Private fields on each campaign invitation. Existing rows stay blank.
-- These values belong to one recipient and are not shared across invitees.
ALTER TABLE "MarketplaceApplication" ADD COLUMN IF NOT EXISTS "offerText" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MarketplaceApplication" ADD COLUMN IF NOT EXISTS "deliverables" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MarketplaceApplication" ADD COLUMN IF NOT EXISTS "responseDeadline" TIMESTAMP(3);
