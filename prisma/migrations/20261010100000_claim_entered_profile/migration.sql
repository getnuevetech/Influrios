-- Clear claim drafts that still store the generated profile sentence.
UPDATE "OnboardingSession"
SET payload = payload || jsonb_build_object(
  'bio', '',
  'locationCity', '',
  'locationCountry', '',
  'specialties', '[]'::jsonb,
  'title', CASE
    WHEN COALESCE(payload->>'title', '') LIKE '% Influencer' THEN ''
    ELSE COALESCE(payload->>'title', '')
  END,
  'displayName', CASE
    WHEN payload->>'displayName' = 'New Influencer' THEN ''
    ELSE COALESCE(payload->>'displayName', '')
  END
)
WHERE (
    payload->>'bio' LIKE 'Draft Influencer Profile%'
    OR payload->>'bio' LIKE 'Draft Influencer Card%'
  )
  AND payload->>'locationCity' = 'Your city'
  AND payload->>'locationCountry' = 'Your country';

UPDATE "Creator"
SET
  bio = '',
  "locationCity" = '',
  "locationCountry" = '',
  title = CASE
    WHEN title LIKE '% Influencer' THEN ''
    ELSE title
  END,
  "displayName" = CASE
    WHEN "displayName" = 'New Influencer' THEN ''
    ELSE "displayName"
  END
WHERE (
    bio LIKE 'Draft Influencer Profile%'
    OR bio LIKE 'Draft Influencer Card%'
  )
  AND "locationCity" = 'Your city'
  AND "locationCountry" = 'Your country';
