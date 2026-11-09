-- Pilot fee pairs. Older rows stay in the table and are left out of new-deal selection.
-- Fee type does not exclude a rule, so deferred fee types are not inserted.
-- Managed introduction and managed campaign are not configured.
-- Funding mode, relationship source, and promotion channel are any, because the quote does not send those conditions.

UPDATE "CollaborationFeeRule"
SET "active" = false,
    "notes" = CASE
      WHEN "notes" LIKE '%Excluded from new-deal selection.%' THEN "notes"
      WHEN "notes" = '' THEN 'Preserved for history. Excluded from new-deal selection.'
      ELSE "notes" || ' Preserved for history. Excluded from new-deal selection.'
    END
WHERE "id" NOT LIKE 'rule_pilot_%';

INSERT INTO "CollaborationFeeRule" (
  "id", "name", "version", "active", "priority", "jurisdiction", "serviceLevel", "feeType",
  "fundingMode", "relationshipSource", "promotionChannel", "method", "percentBps", "fixedCents",
  "minFeeCents", "payer", "purpose", "effectiveFrom", "notes", "updatedAt"
) VALUES
(
  'rule_pilot_discovery_business', 'Discovery Only · Business', 1, true, 600, '*', 'discovery', 'platform_service',
  '*', '*', '*', 'fixed', 0, 0,
  0, 'brand', 'business_platform_fee', TIMESTAMP '2026-11-09T00:00:00.000Z',
  'Discovery stays free. Fixed zero. No gross bounds.', CURRENT_TIMESTAMP
),
(
  'rule_pilot_discovery_influencer', 'Discovery Only · Influencer', 1, true, 600, '*', 'discovery', 'platform_service',
  '*', '*', '*', 'fixed', 0, 0,
  0, 'creator', 'influencer_platform_fee', TIMESTAMP '2026-11-09T00:00:00.000Z',
  'Discovery stays free. Fixed zero. No gross bounds.', CURRENT_TIMESTAMP
),
(
  'rule_pilot_contracted_business', 'Contracted Pilot · Business', 1, true, 700, 'US', 'contracted', 'platform_service',
  '*', '*', '*', 'percent', 500, 0,
  0, 'brand', 'business_platform_fee', TIMESTAMP '2026-11-09T00:00:00.000Z',
  'Pilot business fee, 500 bps added to gross. Self-sourced deals use this pair. Live funding stays off until the launch approvals.', CURRENT_TIMESTAMP
),
(
  'rule_pilot_contracted_influencer', 'Contracted Pilot · Influencer', 1, true, 700, 'US', 'contracted', 'platform_service',
  '*', '*', '*', 'percent', 250, 0,
  0, 'creator', 'influencer_platform_fee', TIMESTAMP '2026-11-09T00:00:00.000Z',
  'Pilot influencer fee, 250 bps deducted from gross compensation. Live funding stays off until the launch approvals.', CURRENT_TIMESTAMP
),
(
  'rule_pilot_platform_match_business', 'Platform Match · Business', 1, false, 700, 'US', 'platform_match', 'platform_service',
  '*', '*', '*', 'percent', 500, 0,
  0, 'brand', 'business_platform_fee', TIMESTAMP '2026-11-09T00:00:00.000Z',
  'Off. Quote a funded agreement as Contracted collaboration unless the signed deal keeps Platform match.', CURRENT_TIMESTAMP
),
(
  'rule_pilot_platform_match_influencer', 'Platform Match · Influencer', 1, false, 700, 'US', 'platform_match', 'platform_service',
  '*', '*', '*', 'percent', 250, 0,
  0, 'creator', 'influencer_platform_fee', TIMESTAMP '2026-11-09T00:00:00.000Z',
  'Off. Quote a funded agreement as Contracted collaboration unless the signed deal keeps Platform match.', CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
