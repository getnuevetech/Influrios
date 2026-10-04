-- W2.3c ownership harden: link marketplace business requests to BusinessWorkspace.
ALTER TABLE "MarketplaceBusinessRequest" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MarketplaceBusinessRequest_workspaceId_fkey'
  ) THEN
    ALTER TABLE "MarketplaceBusinessRequest"
      ADD CONSTRAINT "MarketplaceBusinessRequest_workspaceId_fkey"
      FOREIGN KEY ("workspaceId") REFERENCES "BusinessWorkspace"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "MarketplaceBusinessRequest_workspaceId_idx"
  ON "MarketplaceBusinessRequest"("workspaceId");
