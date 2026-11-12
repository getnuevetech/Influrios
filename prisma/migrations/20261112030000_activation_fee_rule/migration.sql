-- Explicit zero activation. It does not add a second fee on top of the business envelope.
INSERT INTO "CollaborationFeeRule" (
  "id", "name", "version", "active", "priority", "jurisdiction", "serviceLevel", "feeType",
  "fundingMode", "relationshipSource", "promotionChannel", "method", "percentBps", "fixedCents",
  "minFeeCents", "payer", "purpose", "effectiveFrom", "notes", "updatedAt"
) VALUES (
  'rule_pilot_activation_business', 'Platform Activation · Business', 1, true, 700, '*', '*', 'platform_service',
  '*', '*', '*', 'fixed', 0, 0,
  0, 'brand', 'platform_activation', TIMESTAMP '2026-11-09T00:00:00.000Z',
  'Explicit zero activation until an approved allocation is saved. It is capped by the business fee and is not a second minimum.',
  CURRENT_TIMESTAMP
) ON CONFLICT ("id") DO NOTHING;
