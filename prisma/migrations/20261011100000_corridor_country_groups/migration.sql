-- Admin groups country corridors so the list can stay folded. Each country keeps its own row.
CREATE TABLE IF NOT EXISTS "CorridorCountryGroup" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CorridorCountryGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CorridorCountryGroupMember" (
  "groupId" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  CONSTRAINT "CorridorCountryGroupMember_pkey" PRIMARY KEY ("groupId", "countryCode")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CorridorCountryGroupMember_countryCode_key" ON "CorridorCountryGroupMember"("countryCode");
CREATE INDEX IF NOT EXISTS "CorridorCountryGroupMember_groupId_idx" ON "CorridorCountryGroupMember"("groupId");

DO $$ BEGIN
  ALTER TABLE "CorridorCountryGroupMember"
    ADD CONSTRAINT "CorridorCountryGroupMember_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "CorridorCountryGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
