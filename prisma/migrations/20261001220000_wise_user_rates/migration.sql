-- Phase 12.8: jurisdiction minor digits for a Wise user-rate conversion.

ALTER TABLE "CollaborationJurisdiction" ADD COLUMN "minorDigits" INTEGER NOT NULL DEFAULT 2;
