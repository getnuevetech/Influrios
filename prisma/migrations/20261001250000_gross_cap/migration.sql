-- Phase 12.11: USD gross cap for a new prefund. Zero means no cap.
-- A later edit does not cancel a prefund already requested.

ALTER TABLE "MarketplaceSettings" ADD COLUMN "maxGrossCents" INTEGER NOT NULL DEFAULT 0;
