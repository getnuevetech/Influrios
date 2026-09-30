-- Phase D: accounts, consent, and guest usage gates.

ALTER TABLE "User" ADD COLUMN "name" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

ALTER TABLE "OnboardingSession" ADD COLUMN "userId" TEXT;

CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EmailChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "demoCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailChallenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash");

CREATE TABLE "GuestUsagePolicy" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "profileViewSoft" INTEGER NOT NULL DEFAULT 3,
    "profileViewHard" INTEGER NOT NULL DEFAULT 5,
    "searchSoft" INTEGER NOT NULL DEFAULT 10,
    "searchHard" INTEGER NOT NULL DEFAULT 20,
    "softCopy" TEXT NOT NULL,
    "hardCopy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GuestUsagePolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuestUsage" (
    "id" TEXT NOT NULL,
    "profileViews" INTEGER NOT NULL DEFAULT 0,
    "searches" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GuestUsage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OnboardingSession" ADD CONSTRAINT "OnboardingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailChallenge" ADD CONSTRAINT "EmailChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "GuestUsagePolicy" ("id", "profileViewSoft", "profileViewHard", "searchSoft", "searchHard", "softCopy", "hardCopy", "updatedAt")
VALUES (
  'default',
  3,
  5,
  10,
  20,
  'You are browsing as a guest. Create a free account to keep viewing creators.',
  'Create a free account to continue. We will bring you back to this page.',
  CURRENT_TIMESTAMP
);
