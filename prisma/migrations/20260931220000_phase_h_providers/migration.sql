-- Phase H: webhook idempotency, subscription state, and admin SMTP settings.

CREATE TABLE "ProcessedWebhook" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcessedWebhook_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcessedWebhook_provider_eventId_key" ON "ProcessedWebhook"("provider", "eventId");

CREATE TABLE "SubscriptionState" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "creatorSlug" TEXT,
    "sku" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionState_provider_externalId_key" ON "SubscriptionState"("provider", "externalId");
CREATE INDEX "SubscriptionState_userId_idx" ON "SubscriptionState"("userId");

CREATE TABLE "MailSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "host" TEXT NOT NULL DEFAULT '',
    "port" INTEGER NOT NULL DEFAULT 587,
    "username" TEXT NOT NULL DEFAULT '',
    "fromAddress" TEXT NOT NULL DEFAULT '',
    "secretCipher" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MailSettings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SubscriptionState" ADD CONSTRAINT "SubscriptionState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
