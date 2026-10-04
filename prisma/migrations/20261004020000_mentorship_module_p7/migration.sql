-- Collab OS P7: mentorship profiles + request lifecycle.
CREATE TABLE IF NOT EXISTS "MentorshipProfile" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "availability" TEXT NOT NULL DEFAULT 'open',
    "headline" TEXT NOT NULL DEFAULT '',
    "boundaries" TEXT NOT NULL DEFAULT '',
    "nichesJson" JSONB NOT NULL DEFAULT '[]',
    "maxActiveMentees" INTEGER NOT NULL DEFAULT 5,
    "eligible" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MentorshipProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MentorshipProfile_creatorId_key" ON "MentorshipProfile"("creatorId");

ALTER TABLE "MentorshipProfile"
  DROP CONSTRAINT IF EXISTS "MentorshipProfile_creatorId_fkey";
ALTER TABLE "MentorshipProfile"
  ADD CONSTRAINT "MentorshipProfile_creatorId_fkey"
  FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "MentorshipRequest" (
    "id" TEXT NOT NULL,
    "mentorCreatorId" TEXT NOT NULL,
    "menteeCreatorId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "message" TEXT NOT NULL DEFAULT '',
    "responseNote" TEXT NOT NULL DEFAULT '',
    "paidRequested" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MentorshipRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MentorshipRequest_mentorCreatorId_status_idx"
  ON "MentorshipRequest"("mentorCreatorId", "status");
CREATE INDEX IF NOT EXISTS "MentorshipRequest_menteeCreatorId_status_idx"
  ON "MentorshipRequest"("menteeCreatorId", "status");

ALTER TABLE "MentorshipRequest"
  DROP CONSTRAINT IF EXISTS "MentorshipRequest_mentorCreatorId_fkey";
ALTER TABLE "MentorshipRequest"
  ADD CONSTRAINT "MentorshipRequest_mentorCreatorId_fkey"
  FOREIGN KEY ("mentorCreatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MentorshipRequest"
  DROP CONSTRAINT IF EXISTS "MentorshipRequest_menteeCreatorId_fkey";
ALTER TABLE "MentorshipRequest"
  ADD CONSTRAINT "MentorshipRequest_menteeCreatorId_fkey"
  FOREIGN KEY ("menteeCreatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
