ALTER TABLE "CollaborationFunding" ADD COLUMN IF NOT EXISTS "collectionProviderCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CollaborationFunding" ADD COLUMN IF NOT EXISTS "payoutMethod" TEXT NOT NULL DEFAULT '';

ALTER TABLE "CreatorKycSubmission" ADD COLUMN IF NOT EXISTS "gatewaySessionId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CreatorKycSubmission" ADD COLUMN IF NOT EXISTS "gatewaySessionUrl" TEXT NOT NULL DEFAULT '';
