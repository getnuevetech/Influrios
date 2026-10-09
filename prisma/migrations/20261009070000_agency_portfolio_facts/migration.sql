-- A joint portfolio keeps entered metrics and stays unpublished until it is published.
-- The one-click sample portfolio is removed only while it still matches that sample.

ALTER TABLE "AgencyPortfolio" ALTER COLUMN "published" SET DEFAULT false;
ALTER TABLE "AgencyRosterMember" ALTER COLUMN "retainerLabel" SET DEFAULT '';

UPDATE "AgencyPortfolio"
SET "metricsJson" = '[]'::jsonb
WHERE "metricsJson" = '[{"label":"Reach","value":"—"},{"label":"Engagement","value":"—"}]'::jsonb
   OR "metricsJson" = '[{"label": "Reach", "value": "—"}, {"label": "Engagement", "value": "—"}]'::jsonb;

DELETE FROM "AgencyPortfolio"
WHERE title = 'Ops case study'
  AND tagline = 'Complementary collab proof'
  AND outcome = 'Joint story outperformed solo posts on saves.';

UPDATE "AgencyCampaign"
SET summary = ''
WHERE summary = 'Admin-created multi-creator campaign'
  AND "budgetLabel" = '$10K';

UPDATE "AgencyRosterMember"
SET notes = ''
WHERE notes = 'Admin added';
