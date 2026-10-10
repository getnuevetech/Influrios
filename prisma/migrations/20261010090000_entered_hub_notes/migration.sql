-- Clear shortlist, application, and inquiry text that is still a generated sentence.
UPDATE "BusinessShortlistItem"
SET note = NULL
WHERE note IN (
  'Shortlisted from inquiry',
  'Saved from Discover',
  'Invited from shortlist',
  'Invited from suggestions',
  'From inquiry · sent',
  'From inquiry · replied',
  'From inquiry · declined'
)
OR note LIKE 'Suggested for %'
OR note LIKE 'Invited from suggestions for %';

UPDATE "MarketplaceApplication"
SET note = NULL
WHERE note IN ('Invited from shortlist', 'Invited from suggestions')
   OR note LIKE 'Invited from suggestions for %'
   OR note LIKE 'Invitation from %'
   OR note LIKE 'Application from %'
   OR note LIKE 'Apply from hub · %'
   OR note LIKE 'Connect from hub · %';

UPDATE "BusinessInquiry"
SET message = ''
WHERE message ~ '^Hi .+ — we''d love to collaborate( on .+)?\.$';
