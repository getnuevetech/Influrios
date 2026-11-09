-- Fee purpose is part of rule matching. Existing rows stay legacy and do not price a new deal.
ALTER TABLE "CollaborationFeeRule" ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'legacy';
