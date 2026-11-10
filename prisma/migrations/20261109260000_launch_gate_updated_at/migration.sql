-- Prisma @updatedAt does not store a database default. The launch-gate table was created with one.
ALTER TABLE "CollaborationLaunchGate" ALTER COLUMN "updatedAt" DROP DEFAULT;
