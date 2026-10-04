-- Collab OS P5: influencer payout profiles + country activation corridors.
CREATE TABLE IF NOT EXISTS "InfluencerPayoutProfile" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "primaryMethod" TEXT NOT NULL DEFAULT 'local_bank',
    "primaryLabel" TEXT NOT NULL DEFAULT 'Local bank',
    "primaryStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "primaryCountryCode" TEXT,
    "primaryCurrency" TEXT,
    "secondaryMethod" TEXT,
    "secondaryLabel" TEXT,
    "secondaryStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "secondaryCountryCode" TEXT,
    "secondaryCurrency" TEXT,
    "globalPayoutReady" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InfluencerPayoutProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InfluencerPayoutProfile_creatorId_key" ON "InfluencerPayoutProfile"("creatorId");

ALTER TABLE "InfluencerPayoutProfile"
  DROP CONSTRAINT IF EXISTS "InfluencerPayoutProfile_creatorId_fkey";
ALTER TABLE "InfluencerPayoutProfile"
  ADD CONSTRAINT "InfluencerPayoutProfile_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "CountryActivationCorridor" (
    "countryCode" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "collectionProviderCode" TEXT,
    "payoutMethodsJson" JSONB NOT NULL DEFAULT '[]',
    "holdingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "fxEnabled" BOOLEAN NOT NULL DEFAULT false,
    "kycModel" TEXT NOT NULL DEFAULT 'identity_light',
    "notes" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CountryActivationCorridor_pkey" PRIMARY KEY ("countryCode")
);
