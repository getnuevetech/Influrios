-- Delete an unconfirmed prefund that still matches the sample title, amount, and jurisdiction.
-- A confirmed payment, a provider reference, or a changed term keeps the deal.

DELETE FROM "CollaborationFunding"
WHERE title = 'Product launch collab'
  AND "grossCents" = 450000
  AND "jurisdictionCode" = 'US'
  AND status = 'awaiting_provider'
  AND ("providerPaymentId" IS NULL OR "providerPaymentId" = '');
