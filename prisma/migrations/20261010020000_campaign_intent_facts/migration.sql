-- Delete one-click sample briefs that still match the invented defaults.
-- A brief with a custom summary or a changed budget stays.

DELETE FROM "BusinessBrief"
WHERE (
  title = 'Campaign intent · Brand Awareness · beauty'
  OR title = 'Untitled brief'
)
AND goal = 'Brand Awareness'
AND specialty = 'beauty'
AND budget = '$1K – $5K'
AND (location = 'Global' OR location = 'USA')
AND platform = 'INSTAGRAM'
AND summary = '';
