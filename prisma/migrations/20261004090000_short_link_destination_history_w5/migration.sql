-- W5: Pro dynamic destination history + rollback (INFLR.me Spec §9 / Phase 3).
CREATE TABLE "ShortLinkDestinationHistory" (
    "id" TEXT NOT NULL,
    "shortLinkId" TEXT NOT NULL,
    "previousDestination" TEXT NOT NULL,
    "previousKind" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "destinationKind" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "reason" TEXT NOT NULL DEFAULT 'update',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShortLinkDestinationHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShortLinkDestinationHistory_shortLinkId_createdAt_idx"
  ON "ShortLinkDestinationHistory"("shortLinkId", "createdAt");

ALTER TABLE "ShortLinkDestinationHistory"
  ADD CONSTRAINT "ShortLinkDestinationHistory_shortLinkId_fkey"
  FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
