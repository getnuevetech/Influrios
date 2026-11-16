-- Annual billing is a separate price. Existing rows stay monthly until Stripe confirms a yearly price.
ALTER TABLE "SubscriptionState" ADD COLUMN "billingInterval" TEXT NOT NULL DEFAULT 'month';
ALTER TABLE "SubscriptionState" ADD COLUMN "currentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "SubscriptionState" ADD COLUMN "pendingInterval" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SubscriptionState" ADD COLUMN "pendingPriceId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SubscriptionState" ADD COLUMN "pendingEffectiveAt" TIMESTAMP(3);
ALTER TABLE "SubscriptionState" ADD COLUMN "scheduleId" TEXT NOT NULL DEFAULT '';

ALTER TABLE "CheckoutAttempt" ADD COLUMN "billingInterval" TEXT NOT NULL DEFAULT 'month';
