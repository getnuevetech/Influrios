-- Close remaining code-completable PARTIAL residuals (W3.1 methods, W3.6 evidence, W5 entitlement snapshot).
ALTER TABLE "CollaborationFeeRule" ADD COLUMN IF NOT EXISTS "tierBandsJson" JSONB;
ALTER TABLE "CollaborationFunding" ADD COLUMN IF NOT EXISTS "chargebackEvidenceJson" JSONB;
ALTER TABLE "ShortLink" ADD COLUMN IF NOT EXISTS "entitlementSnapshotJson" JSONB;
