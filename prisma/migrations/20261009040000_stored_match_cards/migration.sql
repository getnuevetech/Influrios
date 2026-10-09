-- Replace the default popular-match subtitle that described the retired sample chips.
UPDATE "CmsSection"
SET payload = jsonb_set(
  payload,
  '{popularMatches,subtitle}',
  '"Category pairs saved on this landing."'::jsonb,
  false
)
WHERE key = 'collaboration_landing'
  AND payload #>> '{popularMatches,subtitle}' = 'Explore real examples of influencer and brand categories that work great together.';
