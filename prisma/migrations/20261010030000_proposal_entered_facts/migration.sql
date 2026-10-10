-- Delete one-click proposals that still use the sample scope and the generated title.
-- A proposal with a different scope or title stays.

DELETE FROM "Collaboration"
WHERE scope = 'Joint content series combining both audiences with clear roles and deliverables.'
  AND title LIKE '% × % collab'
  AND (
    why = 'Joint content series combining both audiences with clear roles and deliverables.'
    OR why = 'Collaboration proposal'
  );

-- The save path used this sentence when no match explanation was stored.
UPDATE "Collaboration"
SET why = ''
WHERE why = 'Collaboration proposal';
