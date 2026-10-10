-- Remove one-click fee rules that still match the generated 10% contracted identity.
DELETE FROM "CollaborationFeeRule" AS rule
WHERE rule.name = 'Untitled rule'
  AND rule.priority = 100
  AND rule.jurisdiction = '*'
  AND rule."serviceLevel" = 'contracted'
  AND rule."feeType" = 'collaboration'
  AND rule."fundingMode" = '*'
  AND rule."relationshipSource" = '*'
  AND rule."promotionChannel" = '*'
  AND rule.method = 'percent'
  AND rule."percentBps" = 1000
  AND rule.payer = 'brand'
  AND rule.notes = ''
  AND NOT EXISTS (
    SELECT 1 FROM "CollaborationFeeSnapshot" AS snap WHERE snap."ruleId" = rule.id
  );
