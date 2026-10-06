-- W3.4: Explicit product funding mode on collaboration funding (FULL | STAGED | NONE).
ALTER TABLE "CollaborationFunding"
  ADD COLUMN IF NOT EXISTS "fundingMode" TEXT NOT NULL DEFAULT 'FULL';

UPDATE "CollaborationFunding"
SET "fundingMode" = 'STAGED'
WHERE "scheduleKind" = 'staged' AND "fundingMode" = 'FULL';
