-- Recurring series can be stopped. Team proposals require every member to accept.

ALTER TABLE "CollaborationFunding" ADD COLUMN "seriesStopped" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "TeamProposal" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamProposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamProposalMember" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "creatorSlug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamProposalMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeamProposal_workspaceId_status_idx" ON "TeamProposal"("workspaceId", "status");
CREATE UNIQUE INDEX "TeamProposalMember_proposalId_creatorSlug_key" ON "TeamProposalMember"("proposalId", "creatorSlug");
CREATE INDEX "TeamProposalMember_creatorSlug_status_idx" ON "TeamProposalMember"("creatorSlug", "status");

ALTER TABLE "TeamProposalMember" ADD CONSTRAINT "TeamProposalMember_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "TeamProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
