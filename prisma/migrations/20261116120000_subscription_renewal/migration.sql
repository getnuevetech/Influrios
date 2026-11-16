-- Subscription period start, scheduled end, and renewal reminders.
-- Existing prices, tax, and discounts are unchanged.
ALTER TABLE "SubscriptionState" ADD COLUMN "currentPeriodStart" TIMESTAMP(3);
ALTER TABLE "SubscriptionState" ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "SubscriptionRenewalNotice" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "renewsAt" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionRenewalNotice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionRenewalNotice_subscriptionId_renewsAt_kind_key" ON "SubscriptionRenewalNotice"("subscriptionId", "renewsAt", "kind");

ALTER TABLE "SubscriptionRenewalNotice" ADD CONSTRAINT "SubscriptionRenewalNotice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "SubscriptionState"("id") ON DELETE CASCADE ON UPDATE CASCADE;
