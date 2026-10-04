-- W2.3 tenancy: bind BusinessWorkspace to User; durable CollaborationFunding.workspaceId.
ALTER TABLE "BusinessWorkspace" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BusinessWorkspace_ownerUserId_key'
  ) THEN
    ALTER TABLE "BusinessWorkspace" ADD CONSTRAINT "BusinessWorkspace_ownerUserId_key" UNIQUE ("ownerUserId");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BusinessWorkspace_ownerUserId_fkey'
  ) THEN
    ALTER TABLE "BusinessWorkspace"
      ADD CONSTRAINT "BusinessWorkspace_ownerUserId_fkey"
      FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "CollaborationFunding" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CollaborationFunding_workspaceId_fkey'
  ) THEN
    ALTER TABLE "CollaborationFunding"
      ADD CONSTRAINT "CollaborationFunding_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "BusinessWorkspace"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CollaborationFunding_workspaceId_idx"
  ON "CollaborationFunding"("workspaceId");
