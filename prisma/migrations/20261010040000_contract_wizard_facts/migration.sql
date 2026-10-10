-- Delete an unsigned contract that still matches the one-click wizard defaults.
-- A signed party, a funding instruction, or a changed term keeps the document.

DELETE FROM "ContractDocument" AS document
WHERE document.status = 'sent'
  AND document."fundingId" IS NULL
  AND document.title LIKE '% × %'
  AND document."renderedBody" LIKE '%Deliverables, channels, usage rights, and revision limits for this collaboration.%'
  AND document."renderedBody" LIKE '%Commercial terms: Paid brand partnership%'
  AND COALESCE(document."sourceJson"->>'gross', '') = '5000'
  AND COALESCE(document."sourceJson"->>'jurisdiction', '') = 'US'
  AND COALESCE(document."sourceJson"->>'serviceLevel', '') = 'contracted'
  AND NOT EXISTS (
    SELECT 1
    FROM "ContractParty" AS party
    WHERE party."documentId" = document.id
      AND party.status = 'signed'
  );
