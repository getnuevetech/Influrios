-- Admin on/off for each payment and charge. A missing row keeps the code default.
CREATE TABLE "PaymentChargeSwitch" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentChargeSwitch_pkey" PRIMARY KEY ("key")
);
