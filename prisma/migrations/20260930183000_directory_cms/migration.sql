-- Phase B: profile state, taxonomy synonyms, homepage sections, menus.

CREATE TYPE "ProfileState" AS ENUM ('UNCLAIMED', 'CLAIMED', 'VERIFIED', 'RESTRICTED');

ALTER TABLE "Creator" ADD COLUMN "profileState" "ProfileState" NOT NULL DEFAULT 'UNCLAIMED';

ALTER TABLE "Specialty" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "SpecialtySynonym" (
    "id" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpecialtySynonym_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SpecialtySynonym_term_key" ON "SpecialtySynonym"("term");

ALTER TABLE "SpecialtySynonym" ADD CONSTRAINT "SpecialtySynonym_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CmsSection" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'published',
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CmsSection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CmsSection_key_key" ON "CmsSection"("key");

CREATE TABLE "SiteMenuItem" (
    "id" TEXT NOT NULL,
    "menu" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteMenuItem_pkey" PRIMARY KEY ("id")
);
