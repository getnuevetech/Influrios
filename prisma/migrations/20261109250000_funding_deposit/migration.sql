CREATE TABLE "FundingDeposit" (
    "id" TEXT NOT NULL,
    "fundingId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "payerNote" TEXT NOT NULL DEFAULT '',
    "instructionsJson" JSONB,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FundingDeposit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FundingDeposit_fundingId_status_idx" ON "FundingDeposit"("fundingId", "status");

ALTER TABLE "FundingDeposit" ADD CONSTRAINT "FundingDeposit_fundingId_fkey" FOREIGN KEY ("fundingId") REFERENCES "CollaborationFunding"("id") ON DELETE CASCADE ON UPDATE CASCADE;
