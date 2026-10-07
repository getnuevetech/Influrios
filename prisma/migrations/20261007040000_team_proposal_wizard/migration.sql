-- Team proposals carry a campaign intent, frozen creator shares, and one funding id.

ALTER TABLE "TeamProposal" ADD COLUMN "campaignIntent" TEXT NOT NULL DEFAULT '';
ALTER TABLE "TeamProposal" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "TeamProposal" ADD COLUMN "fundingId" TEXT;

ALTER TABLE "TeamProposalMember" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'creator';
ALTER TABLE "TeamProposalMember" ADD COLUMN "shareBps" INTEGER NOT NULL DEFAULT 0;

-- Proposals sent before shares existed get an even split. The last member absorbs the remainder.
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY "proposalId" ORDER BY "createdAt", id) AS n,
    COUNT(*) OVER (PARTITION BY "proposalId") AS total
  FROM "TeamProposalMember"
)
UPDATE "TeamProposalMember" AS member
SET "shareBps" = CASE
  WHEN numbered.n = numbered.total THEN (10000 - ((10000 / numbered.total) * (numbered.total - 1)))::integer
  ELSE (10000 / numbered.total)::integer
END
FROM numbered
WHERE member.id = numbered.id
  AND member."shareBps" = 0
  AND numbered.total >= 2;
