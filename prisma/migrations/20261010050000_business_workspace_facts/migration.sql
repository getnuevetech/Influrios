-- New workspaces start on the free plan. A plan already saved on a workspace stays.

ALTER TABLE "BusinessWorkspace" ALTER COLUMN "plan" SET DEFAULT 'BUSINESS_FREE';

-- "General" was stored when no industry was entered.
UPDATE "BusinessWorkspace"
SET industry = ''
WHERE industry = 'General';

UPDATE "BusinessProfile"
SET industry = NULL
WHERE industry = 'General';
