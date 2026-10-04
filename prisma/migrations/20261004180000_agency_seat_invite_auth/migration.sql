-- L3 agency seat invite/accept + session auth fields.
ALTER TABLE "AgencySeat" ADD COLUMN IF NOT EXISTS "inviteStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "AgencySeat" ADD COLUMN IF NOT EXISTS "inviteToken" TEXT;
ALTER TABLE "AgencySeat" ADD COLUMN IF NOT EXISTS "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "AgencySeat" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "AgencySeat" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);
ALTER TABLE "AgencySeat" ADD COLUMN IF NOT EXISTS "acceptedUserId" TEXT;
ALTER TABLE "AgencySeat" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Existing active seats (pre-invite CRUD) are treated as already accepted.
UPDATE "AgencySeat"
SET "inviteStatus" = 'accepted',
    "acceptedAt" = COALESCE("acceptedAt", "createdAt"),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "active" = true AND ("inviteStatus" = 'pending' OR "inviteStatus" IS NULL);

CREATE UNIQUE INDEX IF NOT EXISTS "AgencySeat_inviteToken_key" ON "AgencySeat"("inviteToken");
CREATE INDEX IF NOT EXISTS "AgencySeat_inviteStatus_active_idx" ON "AgencySeat"("inviteStatus", "active");
