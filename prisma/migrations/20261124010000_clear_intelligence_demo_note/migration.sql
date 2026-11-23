-- The intelligence notes column defaulted to an internal demo sentence that admins saw as data.
ALTER TABLE "IntelligenceSettings" ALTER COLUMN "notes" SET DEFAULT '';
UPDATE "IntelligenceSettings" SET "notes" = '' WHERE "notes" LIKE 'Phase 5 demo intelligence%';
