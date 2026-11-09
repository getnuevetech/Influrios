-- Rules created before fee purpose existed were stored as legacy.
-- The payer the admin already chose is the side that prices a new contract.
UPDATE "CollaborationFeeRule"
SET "purpose" = 'business_platform_fee'
WHERE "purpose" = 'legacy' AND "payer" = 'brand';

UPDATE "CollaborationFeeRule"
SET "purpose" = 'influencer_platform_fee'
WHERE "purpose" = 'legacy' AND "payer" = 'creator';
