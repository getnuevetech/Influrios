-- Connected-account reference, provider payment and split ids, and corridor capabilities.

ALTER TABLE "InfluencerPayoutProfile" ADD COLUMN "providerConnectedAccountId" TEXT;
ALTER TABLE "CollaborationFunding" ADD COLUMN "providerPaymentId" TEXT;
ALTER TABLE "CollaborationFunding" ADD COLUMN "providerSplitJson" JSONB;
ALTER TABLE "FundingMilestone" ADD COLUMN "providerSplitId" TEXT;

CREATE TABLE "ProviderCorridorCapability" (
    "id" TEXT NOT NULL,
    "providerCode" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "accountType" TEXT,
    "currenciesJson" JSONB,
    "payoutMethod" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCorridorCapability_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderCorridorCapability_providerCode_countryCode_key" ON "ProviderCorridorCapability"("providerCode", "countryCode");
