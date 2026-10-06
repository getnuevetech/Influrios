-- Phase L.4: checkout attempts in Postgres (replaces data/billing.json sessions).

CREATE TABLE "CheckoutAttempt" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "customerEmail" TEXT,
    "userId" TEXT,
    "creatorSlug" TEXT,
    "stripeSessionId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckoutAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CheckoutAttempt_status_createdAt_idx" ON "CheckoutAttempt"("status", "createdAt");

CREATE INDEX "CheckoutAttempt_stripeSessionId_idx" ON "CheckoutAttempt"("stripeSessionId");
