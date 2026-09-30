-- Phase F: collaboration records, taxonomy-linked offers and needs, admin window.

ALTER TABLE "CollaborationOffer" ADD COLUMN "specialtyId" TEXT;
ALTER TABLE "CollaborationNeed" ADD COLUMN "specialtyId" TEXT;

CREATE INDEX "CollaborationOffer_specialtyId_idx" ON "CollaborationOffer"("specialtyId");
CREATE INDEX "CollaborationNeed_specialtyId_idx" ON "CollaborationNeed"("specialtyId");

ALTER TABLE "CollaborationOffer" ADD CONSTRAINT "CollaborationOffer_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CollaborationNeed" ADD CONSTRAINT "CollaborationNeed_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CollaborationSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "windowDays" INTEGER NOT NULL DEFAULT 30,
    "commercialOptions" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CollaborationSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Collaboration" (
    "id" TEXT NOT NULL,
    "initiatorSlug" TEXT NOT NULL,
    "recipientSlug" TEXT NOT NULL,
    "initiatorUserId" TEXT,
    "decidedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "roleInitiator" TEXT NOT NULL,
    "roleRecipient" TEXT NOT NULL,
    "commercial" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "why" TEXT NOT NULL,
    "reasons" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "offerSpecialty" TEXT,
    "needSpecialty" TEXT,
    "sentAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Collaboration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CollaborationEvent" (
    "id" TEXT NOT NULL,
    "collaborationId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "actorUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollaborationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Collaboration_initiatorSlug_status_idx" ON "Collaboration"("initiatorSlug", "status");
CREATE INDEX "Collaboration_recipientSlug_status_idx" ON "Collaboration"("recipientSlug", "status");
CREATE INDEX "CollaborationEvent_collaborationId_idx" ON "CollaborationEvent"("collaborationId");

ALTER TABLE "Collaboration" ADD CONSTRAINT "Collaboration_initiatorUserId_fkey" FOREIGN KEY ("initiatorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Collaboration" ADD CONSTRAINT "Collaboration_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CollaborationEvent" ADD CONSTRAINT "CollaborationEvent_collaborationId_fkey" FOREIGN KEY ("collaborationId") REFERENCES "Collaboration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
