-- Explicit collaboration links and a stored agreement digest.
-- Existing rows stay unlinked. This migration does not match deals by title.
ALTER TABLE "ContractDocument" ADD COLUMN IF NOT EXISTS "contentDigest" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ContractDocument" ADD COLUMN IF NOT EXISTS "applicationId" TEXT;

ALTER TABLE "MarketplaceApplication" ADD COLUMN IF NOT EXISTS "collaborationId" TEXT;
ALTER TABLE "TeamProposal" ADD COLUMN IF NOT EXISTS "collaborationId" TEXT;

CREATE INDEX IF NOT EXISTS "ContractDocument_applicationId_idx" ON "ContractDocument"("applicationId");
CREATE INDEX IF NOT EXISTS "MarketplaceApplication_collaborationId_idx" ON "MarketplaceApplication"("collaborationId");
CREATE INDEX IF NOT EXISTS "TeamProposal_collaborationId_idx" ON "TeamProposal"("collaborationId");

ALTER TABLE "ContractDocument" ADD CONSTRAINT "ContractDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "MarketplaceApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketplaceApplication" ADD CONSTRAINT "MarketplaceApplication_collaborationId_fkey" FOREIGN KEY ("collaborationId") REFERENCES "Collaboration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeamProposal" ADD CONSTRAINT "TeamProposal_collaborationId_fkey" FOREIGN KEY ("collaborationId") REFERENCES "Collaboration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
