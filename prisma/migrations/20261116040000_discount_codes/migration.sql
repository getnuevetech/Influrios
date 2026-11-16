-- Versioned discount codes, reservations, and immutable adjustments.
CREATE TABLE "DiscountOffer" (
    "id" TEXT NOT NULL,
    "normalizedCode" TEXT NOT NULL,
    "displayCode" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "productCharge" TEXT NOT NULL,
    "discountKind" TEXT NOT NULL,
    "percentBps" INTEGER,
    "fixedCents" INTEGER,
    "currency" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "planCode" TEXT NOT NULL DEFAULT '',
    "planName" TEXT NOT NULL DEFAULT '',
    "billingInterval" TEXT NOT NULL DEFAULT '',
    "serviceLevel" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "totalUses" INTEGER NOT NULL,
    "usesPerCustomer" INTEGER NOT NULL DEFAULT 1,
    "lifecycle" TEXT NOT NULL DEFAULT 'draft',
    "reservedCount" INTEGER NOT NULL DEFAULT 0,
    "redeemedCount" INTEGER NOT NULL DEFAULT 0,
    "refundedCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscountOfferAudit" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changesJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountOfferAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscountReservation" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "offerVersion" INTEGER NOT NULL,
    "payerAccountId" TEXT NOT NULL,
    "subjectKind" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "charge" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "baseCents" INTEGER NOT NULL,
    "quoteRef" TEXT NOT NULL DEFAULT '',
    "lineLabel" TEXT NOT NULL DEFAULT '',
    "settlementId" TEXT NOT NULL DEFAULT '',
    "providerOutcome" TEXT NOT NULL DEFAULT 'none',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),

    CONSTRAINT "DiscountReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscountAdjustment" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "quoteRef" TEXT NOT NULL,
    "lineLabel" TEXT NOT NULL,
    "payerAccountId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "offerVersion" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "baseCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscountOffer_normalizedCode_version_key" ON "DiscountOffer"("normalizedCode", "version");
CREATE INDEX "DiscountOffer_normalizedCode_lifecycle_idx" ON "DiscountOffer"("normalizedCode", "lifecycle");
CREATE INDEX "DiscountOfferAudit_offerId_createdAt_idx" ON "DiscountOfferAudit"("offerId", "createdAt");
CREATE UNIQUE INDEX "DiscountReservation_idempotencyKey_key" ON "DiscountReservation"("idempotencyKey");
CREATE INDEX "DiscountReservation_offerId_status_idx" ON "DiscountReservation"("offerId", "status");
CREATE INDEX "DiscountReservation_payerAccountId_offerId_idx" ON "DiscountReservation"("payerAccountId", "offerId");
CREATE INDEX "DiscountReservation_subjectKind_subjectId_idx" ON "DiscountReservation"("subjectKind", "subjectId");
CREATE UNIQUE INDEX "DiscountAdjustment_reservationId_key" ON "DiscountAdjustment"("reservationId");

ALTER TABLE "DiscountOfferAudit" ADD CONSTRAINT "DiscountOfferAudit_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "DiscountOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscountReservation" ADD CONSTRAINT "DiscountReservation_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "DiscountOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscountAdjustment" ADD CONSTRAINT "DiscountAdjustment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "DiscountReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
