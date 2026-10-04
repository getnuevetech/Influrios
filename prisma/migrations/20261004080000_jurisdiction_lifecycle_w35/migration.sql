-- W3.5 — optional per-jurisdiction review window / revision limit overrides.
ALTER TABLE "CollaborationJurisdiction" ADD COLUMN IF NOT EXISTS "reviewWindowHours" INTEGER;
ALTER TABLE "CollaborationJurisdiction" ADD COLUMN IF NOT EXISTS "maxRevisions" INTEGER;
