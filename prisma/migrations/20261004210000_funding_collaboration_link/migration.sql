-- W2.5: durable CollaborationFunding → Collaboration link for hub pipeline.
ALTER TABLE "CollaborationFunding" ADD COLUMN IF NOT EXISTS "collaborationId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CollaborationFunding_collaborationId_fkey'
  ) THEN
    ALTER TABLE "CollaborationFunding"
      ADD CONSTRAINT "CollaborationFunding_collaborationId_fkey"
      FOREIGN KEY ("collaborationId") REFERENCES "Collaboration"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CollaborationFunding_collaborationId_idx"
  ON "CollaborationFunding"("collaborationId");
