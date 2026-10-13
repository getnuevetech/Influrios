-- Optional region/state on creator profiles (admin + signup location).
ALTER TABLE "Creator" ADD COLUMN IF NOT EXISTS "locationState" TEXT;
