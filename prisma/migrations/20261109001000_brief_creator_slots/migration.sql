-- Recruitment capacity is per campaign. One acceptance must not close other briefs.
ALTER TABLE "BusinessBrief" ADD COLUMN IF NOT EXISTS "creatorSlots" INTEGER NOT NULL DEFAULT 1;
