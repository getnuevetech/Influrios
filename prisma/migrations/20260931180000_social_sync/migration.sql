-- Live social connections. Follower and like counts stay empty until a network sync writes them.

ALTER TABLE "SocialAccount" ADD COLUMN "likes" INTEGER;

CREATE TABLE "SocialConnectPolicy" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "version" TEXT NOT NULL,
    "termsText" TEXT NOT NULL,
    "policyText" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SocialConnectPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialConnection" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "providerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'needs_consent',
    "consentVersion" TEXT,
    "consentedAt" TIMESTAMP(3),
    "stateToken" TEXT,
    "externalId" TEXT,
    "tokenCipher" TEXT,
    "refreshCipher" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SocialConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SocialConnection_stateToken_key" ON "SocialConnection"("stateToken");
CREATE UNIQUE INDEX "SocialConnection_creatorId_platform_key" ON "SocialConnection"("creatorId", "platform");

ALTER TABLE "SocialConnection" ADD CONSTRAINT "SocialConnection_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
