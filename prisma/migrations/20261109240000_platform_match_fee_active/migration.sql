-- The platform-match pilot pair was inserted inactive, so the service-level table treated it as missing.
-- Turn both sides on. A paid agreement is still priced as Contracted collaboration before signature.

UPDATE "CollaborationFeeRule"
SET "active" = true,
    "notes" = 'Pilot business fee for Platform match, 500 bps added to gross. A paid agreement is still priced as Contracted collaboration before signature.',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'rule_pilot_platform_match_business';

UPDATE "CollaborationFeeRule"
SET "active" = true,
    "notes" = 'Pilot influencer fee for Platform match, 250 bps deducted from gross. A paid agreement is still priced as Contracted collaboration before signature.',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'rule_pilot_platform_match_influencer';
