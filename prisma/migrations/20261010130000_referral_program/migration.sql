-- Referral registrations use the influencer short link. The reward is the one admin saved.
CREATE TABLE IF NOT EXISTS "ReferralProgram" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "rewardKind" TEXT NOT NULL DEFAULT '',
  "points" INTEGER NOT NULL DEFAULT 0,
  "amountCents" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferralProgram_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReferralRegistration" (
  "id" TEXT NOT NULL,
  "referrerCreatorId" TEXT NOT NULL,
  "shortLinkId" TEXT NOT NULL,
  "referredUserId" TEXT NOT NULL,
  "referredEmail" TEXT NOT NULL,
  "rewardKind" TEXT NOT NULL DEFAULT '',
  "points" INTEGER NOT NULL DEFAULT 0,
  "amountCents" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralRegistration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReferralRegistration_referredUserId_key" ON "ReferralRegistration"("referredUserId");
CREATE INDEX IF NOT EXISTS "ReferralRegistration_referrerCreatorId_createdAt_idx" ON "ReferralRegistration"("referrerCreatorId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReferralRegistration_shortLinkId_idx" ON "ReferralRegistration"("shortLinkId");

DO $$ BEGIN
  ALTER TABLE "ReferralRegistration"
    ADD CONSTRAINT "ReferralRegistration_referrerCreatorId_fkey"
    FOREIGN KEY ("referrerCreatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ReferralRegistration"
    ADD CONSTRAINT "ReferralRegistration_shortLinkId_fkey"
    FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ReferralRegistration"
    ADD CONSTRAINT "ReferralRegistration_referredUserId_fkey"
    FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
