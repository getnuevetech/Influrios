-- A raw jurisdiction insert is not approved until a legal review status is entered.
ALTER TABLE "CollaborationJurisdiction" ALTER COLUMN "legalReviewStatus" SET DEFAULT 'PENDING';
