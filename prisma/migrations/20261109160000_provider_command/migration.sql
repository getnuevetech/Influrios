-- A provider command is stored before it is sent. The operation key stops a second send.
CREATE TABLE "ProviderCommand" (
  "id" TEXT NOT NULL,
  "operationKey" TEXT NOT NULL,
  "fundingId" TEXT NOT NULL,
  "milestoneId" TEXT,
  "agreementVersion" INTEGER NOT NULL DEFAULT 1,
  "operation" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "providerRef" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dispatchedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderCommand_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderCommand_operationKey_key" ON "ProviderCommand"("operationKey");
CREATE INDEX "ProviderCommand_fundingId_operation_idx" ON "ProviderCommand"("fundingId", "operation");
