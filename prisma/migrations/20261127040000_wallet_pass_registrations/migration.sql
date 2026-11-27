-- CreateTable
CREATE TABLE "WalletPassRegistration" (
    "id" TEXT NOT NULL,
    "deviceLibraryId" TEXT NOT NULL,
    "pushToken" TEXT NOT NULL,
    "passTypeIdentifier" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletPassRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WalletPassRegistration_serialNumber_idx" ON "WalletPassRegistration"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WalletPassRegistration_deviceLibraryId_passTypeIdentifier_s_key" ON "WalletPassRegistration"("deviceLibraryId", "passTypeIdentifier", "serialNumber");

