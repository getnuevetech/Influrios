-- First and last acquisition sources. A blank source means none was recorded.
ALTER TABLE "OnboardingSession" ADD COLUMN IF NOT EXISTS "firstTouchSource" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OnboardingSession" ADD COLUMN IF NOT EXISTS "firstTouchAt" TIMESTAMP(3);
ALTER TABLE "OnboardingSession" ADD COLUMN IF NOT EXISTS "lastTouchSource" TEXT NOT NULL DEFAULT '';
ALTER TABLE "OnboardingSession" ADD COLUMN IF NOT EXISTS "lastTouchAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "AgencyImportRow" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT '',
  "email" TEXT NOT NULL DEFAULT '',
  "handle" TEXT NOT NULL,
  "platform" TEXT NOT NULL DEFAULT '',
  "source" TEXT NOT NULL DEFAULT '',
  "sessionId" TEXT,
  "error" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgencyImportRow_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "AgencyImportRow" ADD CONSTRAINT "AgencyImportRow_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "OnboardingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
