-- The pilot migration turned off every non-pilot fee rule.
-- Restore rules the paid quote cannot select: another country, a managed service,
-- or a funding mode, relationship source, or promotion channel the quote does not send.
-- Discovery, any-service, and US contracted or platform-match rules with open conditions stay off.

UPDATE "CollaborationFeeRule"
SET "active" = true,
    "notes" = CASE
      WHEN "notes" = 'Preserved for history. Excluded from new-deal selection.' THEN ''
      ELSE replace("notes", ' Preserved for history. Excluded from new-deal selection.', '')
    END,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" NOT LIKE 'rule_pilot_%'
  AND "notes" LIKE '%Excluded from new-deal selection.%'
  AND NOT (
    "payer" IN ('brand', 'creator')
    AND "purpose" IN ('business_platform_fee', 'influencer_platform_fee', 'legacy')
    AND "fundingMode" IN ('*', '')
    AND "relationshipSource" IN ('*', '')
    AND "promotionChannel" IN ('*', '')
    AND (
      "serviceLevel" IN ('discovery', '*')
      OR ("serviceLevel" IN ('contracted', 'platform_match') AND "jurisdiction" IN ('US', '*'))
    )
  );
