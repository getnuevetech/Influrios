-- Admin-managed footer stats, account policy, and member suspension.

ALTER TABLE "User" ADD COLUMN "suspendedAt" TIMESTAMP(3);

CREATE TABLE "FooterStat" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FooterStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FooterStat_key_key" ON "FooterStat"("key");

CREATE TABLE "SiteConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "footerTagline" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "consentCopy" TEXT NOT NULL,
    "passwordMinLength" INTEGER NOT NULL DEFAULT 8,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteConfig_pkey" PRIMARY KEY ("id")
);

INSERT INTO "FooterStat" ("id", "key", "value", "label", "iconKey", "tone", "sortOrder", "enabled", "updatedAt")
VALUES
  ('stat_influencers', 'influencers', '50K+', 'Influencers Worldwide', 'user', 'violet', 0, true, CURRENT_TIMESTAMP),
  ('stat_categories', 'categories', '100+', 'Categories & Niches', 'users', 'sky', 1, true, CURRENT_TIMESTAMP),
  ('stat_collaborations', 'collaborations', '12K+', 'Active Collaborations', 'handshake', 'violet', 2, true, CURRENT_TIMESTAMP),
  ('stat_matches', 'matches', '5K+', 'Business Matches', 'building', 'blue', 3, true, CURRENT_TIMESTAMP);

INSERT INTO "SiteConfig" ("id", "footerTagline", "consentVersion", "consentCopy", "passwordMinLength", "updatedAt")
VALUES (
  'default',
  'A growing creator economy together.',
  '2026-09-30',
  'I agree to the Influrios account terms',
  8,
  CURRENT_TIMESTAMP
);
