-- Admin-editable option lists for Campaign Intent selects (collab type + timeframe).
CREATE TABLE IF NOT EXISTS "CatalogOption" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogOption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CatalogOption_kind_value_key" ON "CatalogOption"("kind", "value");

CREATE INDEX IF NOT EXISTS "CatalogOption_kind_active_sortOrder_idx" ON "CatalogOption"("kind", "active", "sortOrder");

-- Campaign Intent structured fields on BusinessBrief (collab type, timeframe, budget currency).
ALTER TABLE "BusinessBrief" ADD COLUMN IF NOT EXISTS "budgetCurrency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "BusinessBrief" ADD COLUMN IF NOT EXISTS "collabType" TEXT NOT NULL DEFAULT '';
ALTER TABLE "BusinessBrief" ADD COLUMN IF NOT EXISTS "timeframe" TEXT NOT NULL DEFAULT '';
