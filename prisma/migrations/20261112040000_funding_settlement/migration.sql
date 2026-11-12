-- Versioned cancellation settlements. An accepted row is the frozen instruction finance executes.
CREATE TABLE "FundingSettlement" (
    "id" TEXT NOT NULL,
    "fundingId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "proposalJson" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "acceptedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingSettlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FundingSettlement_fundingId_versionNumber_key" ON "FundingSettlement"("fundingId", "versionNumber");

CREATE INDEX "FundingSettlement_fundingId_status_idx" ON "FundingSettlement"("fundingId", "status");

ALTER TABLE "FundingSettlement" ADD CONSTRAINT "FundingSettlement_fundingId_fkey" FOREIGN KEY ("fundingId") REFERENCES "CollaborationFunding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
