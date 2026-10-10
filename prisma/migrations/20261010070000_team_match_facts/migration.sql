-- Team rows recorded a fixed 80 and the sentence "Team proposal".
-- A stored campaign intent stays. The score was not calculated.

UPDATE "MarketplaceMatchRecord"
SET
  score = 0,
  why = CASE WHEN why = 'Team proposal' THEN '' ELSE why END,
  "reasonsJson" = CASE
    WHEN why = 'Team proposal' OR why = '' THEN '[]'::jsonb
    ELSE jsonb_build_array(why)
  END,
  "breakdownJson" = '{"audienceAlignment":0,"contentCompatibility":0,"goalSynergy":0,"engagementPotential":0}'::jsonb
WHERE "modelVersion" = 'team-proposal-v1'
  AND score = 80;
