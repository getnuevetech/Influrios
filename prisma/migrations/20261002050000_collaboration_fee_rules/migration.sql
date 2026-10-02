-- Phase O: collaboration fee rules + admin simulator snapshots in Postgres
-- (replaces data/collaboration-fees.json). Funding feeSnapshotJson is unchanged.

CREATE TABLE "CollaborationFeeRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "jurisdiction" TEXT NOT NULL DEFAULT '*',
    "serviceLevel" TEXT NOT NULL DEFAULT 'contracted',
    "minGrossCents" INTEGER,
    "maxGrossCents" INTEGER,
    "method" TEXT NOT NULL DEFAULT 'percent',
    "percentBps" INTEGER NOT NULL DEFAULT 0,
    "fixedCents" INTEGER NOT NULL DEFAULT 0,
    "minFeeCents" INTEGER NOT NULL DEFAULT 0,
    "maxFeeCents" INTEGER,
    "payer" TEXT NOT NULL DEFAULT 'brand',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollaborationFeeRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CollaborationFeeRule_active_priority_idx" ON "CollaborationFeeRule"("active", "priority");
CREATE INDEX "CollaborationFeeRule_jurisdiction_serviceLevel_idx" ON "CollaborationFeeRule"("jurisdiction", "serviceLevel");

CREATE TABLE "CollaborationFeeSnapshot" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "payer" TEXT NOT NULL,
    "basisCents" INTEGER NOT NULL,
    "percentBps" INTEGER NOT NULL,
    "fixedCents" INTEGER NOT NULL,
    "calculatedFeeCents" INTEGER NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "serviceLevel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollaborationFeeSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CollaborationFeeSnapshot_createdAt_idx" ON "CollaborationFeeSnapshot"("createdAt");
