-- Contract agreement redesign: document types, agreement refs, party identity fields.
ALTER TABLE "ContractTemplate" ADD COLUMN IF NOT EXISTS "documentType" TEXT NOT NULL DEFAULT 'collaboration';
ALTER TABLE "ContractTemplate" ADD COLUMN IF NOT EXISTS "scope" TEXT NOT NULL DEFAULT 'platform';
ALTER TABLE "ContractTemplate" ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;
ALTER TABLE "ContractTemplate" ADD COLUMN IF NOT EXISTS "versionLabel" TEXT NOT NULL DEFAULT 'v1.0';
ALTER TABLE "ContractTemplate" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ContractTemplate" ADD COLUMN IF NOT EXISTS "published" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "ContractTemplate_scope_workspaceId_documentType_idx"
  ON "ContractTemplate"("scope", "workspaceId", "documentType");

ALTER TABLE "ContractDocument" ADD COLUMN IF NOT EXISTS "agreementRef" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ContractDocument" ADD COLUMN IF NOT EXISTS "documentType" TEXT NOT NULL DEFAULT 'collaboration';
ALTER TABLE "ContractDocument" ADD COLUMN IF NOT EXISTS "versionLabel" TEXT NOT NULL DEFAULT 'v1.0';
ALTER TABLE "ContractDocument" ADD COLUMN IF NOT EXISTS "partiesSnapshotJson" JSONB;

CREATE INDEX IF NOT EXISTS "ContractDocument_agreementRef_idx" ON "ContractDocument"("agreementRef");
CREATE INDEX IF NOT EXISTS "ContractDocument_documentType_status_idx" ON "ContractDocument"("documentType", "status");

ALTER TABLE "ContractParty" ADD COLUMN IF NOT EXISTS "legalEntityName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ContractParty" ADD COLUMN IF NOT EXISTS "capacity" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ContractParty" ADD COLUMN IF NOT EXISTS "handle" TEXT NOT NULL DEFAULT '';
