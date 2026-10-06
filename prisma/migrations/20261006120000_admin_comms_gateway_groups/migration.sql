-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredCommChannel" TEXT NOT NULL DEFAULT 'email';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentCountryGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentCountryGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PaymentCountryGroupMember" (
    "groupId" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,

    CONSTRAINT "PaymentCountryGroupMember_pkey" PRIMARY KEY ("groupId","countryCode")
);

CREATE TABLE IF NOT EXISTS "CommChannelSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "smsProviderNote" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommChannelSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "audience" TEXT NOT NULL DEFAULT 'all',
    "mode" TEXT NOT NULL DEFAULT 'auto',
    "triggerKey" TEXT NOT NULL DEFAULT 'custom',
    "subject" TEXT NOT NULL DEFAULT '',
    "bodyEmail" TEXT NOT NULL DEFAULT '',
    "bodySms" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentCountryGroupMember_countryCode_key" ON "PaymentCountryGroupMember"("countryCode");
CREATE INDEX IF NOT EXISTS "PaymentCountryGroupMember_groupId_idx" ON "PaymentCountryGroupMember"("groupId");
CREATE UNIQUE INDEX IF NOT EXISTS "CommTemplate_key_key" ON "CommTemplate"("key");

DO $$ BEGIN
  ALTER TABLE "PaymentCountryGroup" ADD CONSTRAINT "PaymentCountryGroup_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "IntegrationProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentCountryGroupMember" ADD CONSTRAINT "PaymentCountryGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PaymentCountryGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
