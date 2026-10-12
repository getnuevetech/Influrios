-- Discover content styles and commercial modes. A creator link is stored only when that creator chooses the term.
CREATE TABLE IF NOT EXISTS "DiscoveryFacet" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DiscoveryFacet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DiscoveryFacet_kind_slug_key" ON "DiscoveryFacet"("kind", "slug");

CREATE TABLE IF NOT EXISTS "CreatorDiscoveryFacet" (
  "creatorId" TEXT NOT NULL,
  "facetId" TEXT NOT NULL,
  CONSTRAINT "CreatorDiscoveryFacet_pkey" PRIMARY KEY ("creatorId", "facetId")
);

DO $$ BEGIN
  ALTER TABLE "CreatorDiscoveryFacet" ADD CONSTRAINT "CreatorDiscoveryFacet_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CreatorDiscoveryFacet" ADD CONSTRAINT "CreatorDiscoveryFacet_facetId_fkey" FOREIGN KEY ("facetId") REFERENCES "DiscoveryFacet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
