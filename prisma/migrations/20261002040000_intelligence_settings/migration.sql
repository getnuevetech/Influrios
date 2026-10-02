-- Phase O: intelligence ops prefs in Postgres (replaces data/intelligence.json).

CREATE TABLE "IntelligenceSettings" (
    "id" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT 'Phase 5 demo intelligence — synthetic trends + seed demographics.',
    "watchedSpecialties" TEXT[] NOT NULL DEFAULT ARRAY['beauty', 'travel', 'home-interior', 'fashion']::TEXT[],
    "lastExportAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntelligenceSettings_pkey" PRIMARY KEY ("id")
);
