-- P6: guest collab propose/apply counters for control-plane thresholds.
ALTER TABLE "GuestUsage" ADD COLUMN IF NOT EXISTS "collabProposes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GuestUsage" ADD COLUMN IF NOT EXISTS "collabApplies" INTEGER NOT NULL DEFAULT 0;
