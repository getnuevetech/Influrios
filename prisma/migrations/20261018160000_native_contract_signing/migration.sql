-- Native in-app signing is primary; DocuSign remains an optional channel.
ALTER TABLE "ContractDocument" ADD COLUMN IF NOT EXISTS "signingChannel" TEXT NOT NULL DEFAULT 'native';
ALTER TABLE "ContractParty" ADD COLUMN IF NOT EXISTS "attestation" TEXT NOT NULL DEFAULT '';
