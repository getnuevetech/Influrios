-- Signed agreements keep a commercial snapshot. Funding links back in the same instruction.
ALTER TABLE "ContractDocument" ADD COLUMN IF NOT EXISTS "termsSnapshotJson" JSONB;
ALTER TABLE "ContractDocument" ADD COLUMN IF NOT EXISTS "voidReason" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ContractDocument" ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3);
ALTER TABLE "ContractDocument" ADD COLUMN IF NOT EXISTS "supersededById" TEXT;

ALTER TABLE "CollaborationFunding" ADD COLUMN IF NOT EXISTS "contractDocumentId" TEXT;
ALTER TABLE "CollaborationFunding" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "CollaborationFunding_contractDocumentId_key" ON "CollaborationFunding"("contractDocumentId");
CREATE UNIQUE INDEX IF NOT EXISTS "CollaborationFunding_idempotencyKey_key" ON "CollaborationFunding"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "ContractDocument_fundingId_idx" ON "ContractDocument"("fundingId");
CREATE INDEX IF NOT EXISTS "ContractDocument_collaborationId_idx" ON "ContractDocument"("collaborationId");
CREATE INDEX IF NOT EXISTS "ContractDocument_teamProposalId_idx" ON "ContractDocument"("teamProposalId");
CREATE INDEX IF NOT EXISTS "ContractDocument_status_createdAt_idx" ON "ContractDocument"("status", "createdAt");

ALTER TABLE "ContractDocument" ADD CONSTRAINT "ContractDocument_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "ContractDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ContractTermAmendment" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "grossCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "creatorsJson" JSONB NOT NULL,
  "milestonesJson" JSONB NOT NULL,
  "actor" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractTermAmendment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContractTermAmendment_documentId_createdAt_idx" ON "ContractTermAmendment"("documentId", "createdAt");

ALTER TABLE "ContractTermAmendment" ADD CONSTRAINT "ContractTermAmendment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ContractDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
