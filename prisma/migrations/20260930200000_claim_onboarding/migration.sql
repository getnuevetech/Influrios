-- Phase C: onboarding sessions, claims, verification attempts, completion rules.

CREATE TYPE "OnboardingState" AS ENUM ('DRAFT', 'CLAIMED', 'EMAIL_VERIFIED', 'PUBLISHED');

CREATE TABLE "OnboardingSession" (
    "id" TEXT NOT NULL,
    "state" "OnboardingState" NOT NULL DEFAULT 'DRAFT',
    "inputHandle" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "draftSlug" TEXT NOT NULL,
    "email" TEXT,
    "ownerName" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "socialVerifiedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "verifyMethod" TEXT NOT NULL DEFAULT 'DEMO_CODE',
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OnboardingSession_draftSlug_key" ON "OnboardingSession"("draftSlug");

CREATE TABLE "ProfileClaim" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "creatorId" TEXT,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerificationAttempt" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProfileCompletionRule" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hint" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProfileCompletionRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfileCompletionRule_key_key" ON "ProfileCompletionRule"("key");

ALTER TABLE "ProfileClaim" ADD CONSTRAINT "ProfileClaim_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "OnboardingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerificationAttempt" ADD CONSTRAINT "VerificationAttempt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "OnboardingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ProfileCompletionRule" ("id", "key", "label", "hint", "weight", "active", "sortOrder") VALUES
  ('rule_claimed', 'claimed', 'Claim ownership', 'Attach your email and take ownership of this draft', 20, true, 1),
  ('rule_email', 'email_verified', 'Verify email', 'Confirm the demo code. This does not verify the social account.', 25, true, 2),
  ('rule_published', 'published', 'Publish Starter card', 'Make the card live on Discover and at /c/{slug}', 25, true, 3),
  ('rule_bio', 'bio', 'Write a real bio', 'Replace the draft placeholder bio', 10, true, 4),
  ('rule_location', 'location', 'Set real location', 'City and country help brands find you', 10, true, 5),
  ('rule_specialty', 'specialty', 'Confirm specialty', 'Pick the niche you actually influence', 10, true, 6);
