-- The business landing directory row is published profiles, not example matches.
-- A custom heading stays.

UPDATE "CmsSection"
SET payload = jsonb_set(
  payload,
  '{recommended,title}',
  to_jsonb('Influencers on Influrios'::text),
  false
)
WHERE key = 'business_landing'
  AND payload #>> '{recommended,title}' = 'Recommended Influencers for Your Business';

UPDATE "CmsSection"
SET payload = jsonb_set(
  payload,
  '{recommended,subtitle}',
  to_jsonb('Published directory profiles. Open a profile to see what is stored.'::text),
  false
)
WHERE key = 'business_landing'
  AND payload #>> '{recommended,subtitle}' = 'Example matches from the Influrios directory — open a profile when you are ready.';
