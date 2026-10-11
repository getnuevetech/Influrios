-- New payout profiles use this code when the country has no corridor.
ALTER TABLE "MarketplaceSettings" ADD COLUMN IF NOT EXISTS "payoutFallbackCurrency" TEXT NOT NULL DEFAULT 'USD';
