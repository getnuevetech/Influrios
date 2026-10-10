-- The create path stored this sentence when no notes were entered.
-- A note that was written stays.

UPDATE "AgencyWorkspace"
SET notes = ''
WHERE notes = 'Admin-created agency workspace.';
