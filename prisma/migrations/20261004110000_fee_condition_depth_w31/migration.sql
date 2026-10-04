-- W3.1: fee rule conditions for funding mode, relationship source, promotion channel.
ALTER TABLE "CollaborationFeeRule" ADD COLUMN IF NOT EXISTS "fundingMode" TEXT NOT NULL DEFAULT '*';
ALTER TABLE "CollaborationFeeRule" ADD COLUMN IF NOT EXISTS "relationshipSource" TEXT NOT NULL DEFAULT '*';
ALTER TABLE "CollaborationFeeRule" ADD COLUMN IF NOT EXISTS "promotionChannel" TEXT NOT NULL DEFAULT '*';
