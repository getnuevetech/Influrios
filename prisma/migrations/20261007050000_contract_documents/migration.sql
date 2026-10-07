-- Generated collaboration agreements, the parties who sign them, and messages kept on the contract.

CREATE TABLE "ContractTemplate" (
    "id" TEXT NOT NULL DEFAULT 'collaboration',
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContractDocument" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "collaborationId" TEXT,
    "fundingId" TEXT,
    "teamProposalId" TEXT,
    "title" TEXT NOT NULL,
    "renderedBody" TEXT NOT NULL,
    "pdfBytes" BYTEA NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "envelopeId" TEXT NOT NULL DEFAULT '',
    "createdByUserId" TEXT,
    "sourceJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContractParty" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "creatorSlug" TEXT,
    "shareBps" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractParty_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContractMessage" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "senderUserId" TEXT,
    "senderAdminId" TEXT,
    "senderName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "recipientPartyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContractDocument_workspaceId_createdAt_idx" ON "ContractDocument"("workspaceId", "createdAt");
CREATE INDEX "ContractDocument_envelopeId_idx" ON "ContractDocument"("envelopeId");
CREATE INDEX "ContractDocument_createdByUserId_idx" ON "ContractDocument"("createdByUserId");
CREATE INDEX "ContractParty_documentId_idx" ON "ContractParty"("documentId");
CREATE INDEX "ContractParty_userId_idx" ON "ContractParty"("userId");
CREATE INDEX "ContractMessage_documentId_createdAt_idx" ON "ContractMessage"("documentId", "createdAt");

ALTER TABLE "ContractParty" ADD CONSTRAINT "ContractParty_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ContractDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractMessage" ADD CONSTRAINT "ContractMessage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ContractDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
