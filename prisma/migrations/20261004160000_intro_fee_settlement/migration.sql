-- W4: sandbox intro-fee settlement fields on ManagedIntro (R073 — not protected payment).
ALTER TABLE "ManagedIntro" ADD COLUMN IF NOT EXISTS "feeExpectedCents" INTEGER;
ALTER TABLE "ManagedIntro" ADD COLUMN IF NOT EXISTS "feeQuoteJson" JSONB;
ALTER TABLE "ManagedIntro" ADD COLUMN IF NOT EXISTS "feeIntentRef" TEXT;
ALTER TABLE "ManagedIntro" ADD COLUMN IF NOT EXISTS "feeProviderRef" TEXT;
ALTER TABLE "ManagedIntro" ADD COLUMN IF NOT EXISTS "feeSettlementAt" TIMESTAMP(3);
