-- W3.5–W3.6: auto-approval toggle + kill-fee defaults on marketplace settings.
ALTER TABLE "MarketplaceSettings"
  ADD COLUMN IF NOT EXISTS "autoApprovalEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "MarketplaceSettings"
  ADD COLUMN IF NOT EXISTS "killFeeBps" INTEGER NOT NULL DEFAULT 2500;
ALTER TABLE "MarketplaceSettings"
  ADD COLUMN IF NOT EXISTS "killFeeFixedCents" INTEGER NOT NULL DEFAULT 0;
