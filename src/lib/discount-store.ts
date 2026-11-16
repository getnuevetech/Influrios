import { prisma } from "@/lib/db";
import {
  consumeDecision,
  discountReport,
  offerStatus,
  reserveDecision,
  reviseOffer,
  type BillingInterval,
  type DiscountAdjustment,
  type DiscountKind,
  type DiscountOffer,
  type ProductCharge,
  type QuoteContext,
  type ReservationRecord,
} from "@/lib/discount-codes";

type OfferRow = {
  id: string;
  normalizedCode: string;
  displayCode: string;
  version: number;
  productCharge: string;
  discountKind: string;
  percentBps: number | null;
  fixedCents: number | null;
  currency: string;
  countryCode: string;
  planCode: string;
  planName: string;
  billingInterval: string;
  serviceLevel: string;
  startsAt: Date;
  endsAt: Date;
  totalUses: number;
  usesPerCustomer: number;
  lifecycle: string;
  reservedCount: number;
  redeemedCount: number;
  refundedCount: number;
};

function asOffer(row: OfferRow): DiscountOffer {
  return {
    id: row.id,
    version: row.version,
    normalizedCode: row.normalizedCode,
    displayCode: row.displayCode,
    productCharge: row.productCharge as ProductCharge,
    kind: row.discountKind as DiscountKind,
    percentBps: row.percentBps,
    fixedCents: row.fixedCents,
    currency: row.currency,
    countryCode: row.countryCode,
    planCode: row.planCode,
    planName: row.planName,
    billingInterval: (row.billingInterval || "") as BillingInterval | "",
    serviceLevel: row.serviceLevel,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    totalUses: row.totalUses,
    usesPerCustomer: row.usesPerCustomer,
    lifecycle: row.lifecycle === "active" || row.lifecycle === "paused" ? row.lifecycle : "draft",
    reservedCount: row.reservedCount,
    redeemedCount: row.redeemedCount,
    refundedCount: row.refundedCount,
  };
}

function asReservation(row: {
  id: string;
  offerId: string;
  offerVersion: number;
  payerAccountId: string;
  idempotencyKey: string;
  status: string;
  amountCents: number;
  settlementId: string;
  refundedAt: Date | null;
  providerOutcome: string;
}): ReservationRecord {
  const outcome = row.providerOutcome;
  return {
    id: row.id,
    offerId: row.offerId,
    version: row.offerVersion,
    accountId: row.payerAccountId,
    idempotencyKey: row.idempotencyKey,
    status: row.status === "consumed" || row.status === "released" ? row.status : "reserved",
    amountCents: row.amountCents,
    settlementId: row.settlementId,
    refundedAt: row.refundedAt?.toISOString() ?? "",
    providerOutcome:
      outcome === "unknown" || outcome === "abandoned" || outcome === "confirmed" || outcome === "cancelled" ? outcome : "none",
  };
}

const unavailable = "Discount codes are unavailable. Nothing was charged.";

export async function listDiscountOffers() {
  try {
    const rows = await prisma.discountOffer.findMany({ orderBy: [{ normalizedCode: "asc" }, { version: "desc" }] });
    const latest = new Map<string, OfferRow>();
    for (const row of rows) {
      if (!latest.has(row.normalizedCode)) latest.set(row.normalizedCode, row);
    }
    return { ok: true as const, offers: [...latest.values()].map(asOffer) };
  } catch {
    return { ok: false as const, error: unavailable, offers: [] as DiscountOffer[] };
  }
}

export async function findDiscountOffer(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  try {
    const row = await prisma.discountOffer.findFirst({
      where: { normalizedCode: normalized, lifecycle: { in: ["active", "paused"] } },
      orderBy: { version: "desc" },
    });
    return row ? asOffer(row) : null;
  } catch {
    return null;
  }
}

export async function customerUseCount(offerId: string, accountId: string) {
  try {
    return await prisma.discountReservation.count({
      where: { offerId, payerAccountId: accountId, status: { in: ["reserved", "consumed"] } },
    });
  } catch {
    return 0;
  }
}

export async function saveDiscountOffer(input: {
  actorId: string;
  existingId?: string;
  lifecycle: "draft" | "active" | "paused";
  draft: Omit<DiscountOffer, "id" | "version" | "lifecycle" | "reservedCount" | "redeemedCount" | "refundedCount">;
}) {
  try {
    const existing = input.existingId ? await prisma.discountOffer.findUnique({ where: { id: input.existingId } }) : null;
    if (input.existingId && !existing) return { ok: false as const, error: "That code was not found." };
    const conflict = await prisma.discountOffer.findFirst({
      where: {
        normalizedCode: input.draft.normalizedCode,
        ...(existing ? { NOT: { normalizedCode: existing.normalizedCode } } : {}),
      },
    });
    if (conflict) return { ok: false as const, error: "That code already exists. Open it to edit the current version." };
    if (!existing) {
      const duplicate = await prisma.discountOffer.findFirst({ where: { normalizedCode: input.draft.normalizedCode } });
      if (duplicate) return { ok: false as const, error: "That code already exists. Open it to edit the current version." };
    }
    const data = {
      normalizedCode: input.draft.normalizedCode,
      displayCode: input.draft.displayCode,
      productCharge: input.draft.productCharge,
      discountKind: input.draft.kind,
      percentBps: input.draft.percentBps,
      fixedCents: input.draft.fixedCents,
      currency: input.draft.currency,
      countryCode: input.draft.countryCode,
      planCode: input.draft.planCode,
      planName: input.draft.planName,
      billingInterval: input.draft.billingInterval,
      serviceLevel: input.draft.serviceLevel,
      startsAt: new Date(input.draft.startsAt),
      endsAt: new Date(input.draft.endsAt),
      totalUses: input.draft.totalUses,
      usesPerCustomer: input.draft.usesPerCustomer,
      lifecycle: input.lifecycle,
      createdById: input.actorId,
    };
    const current = existing ? asOffer(existing) : null;
    const hasRedemptions = Boolean(current && (current.redeemedCount > 0 || current.reservedCount > 0));
    const saved = await prisma.$transaction(async (tx) => {
      if (!existing) {
        const created = await tx.discountOffer.create({ data: { ...data, version: 1 } });
        await tx.discountOfferAudit.create({
          data: { offerId: created.id, actorId: input.actorId, action: input.lifecycle === "active" ? "activate" : "draft", changesJson: data },
        });
        return created;
      }
      if (!hasRedemptions) {
        const updated = await tx.discountOffer.update({ where: { id: existing.id }, data });
        await tx.discountOfferAudit.create({
          data: { offerId: updated.id, actorId: input.actorId, action: input.lifecycle, changesJson: data },
        });
        return updated;
      }
      const revised = reviseOffer(current!, { ...input.draft, lifecycle: input.lifecycle }, true);
      const created = await tx.discountOffer.create({
        data: { ...data, version: revised.version, lifecycle: input.lifecycle },
      });
      await tx.discountOfferAudit.create({
        data: {
          offerId: created.id,
          actorId: input.actorId,
          action: "revise",
          changesJson: { previousId: existing.id, previousVersion: existing.version, ...data },
        },
      });
      return created;
    });
    return { ok: true as const, offer: asOffer(saved) };
  } catch {
    return { ok: false as const, error: unavailable };
  }
}

export async function setDiscountLifecycle(input: { id: string; actorId: string; lifecycle: "active" | "paused" }) {
  try {
    const row = await prisma.discountOffer.update({ where: { id: input.id }, data: { lifecycle: input.lifecycle } });
    await prisma.discountOfferAudit.create({
      data: { offerId: row.id, actorId: input.actorId, action: input.lifecycle === "paused" ? "pause" : "activate", changesJson: { lifecycle: input.lifecycle } },
    });
    return { ok: true as const, offer: asOffer(row) };
  } catch {
    return { ok: false as const, error: unavailable };
  }
}

export async function listDiscountAudits(offerId: string) {
  try {
    return await prisma.discountOfferAudit.findMany({ where: { offerId }, orderBy: { createdAt: "desc" }, take: 20 });
  } catch {
    return [];
  }
}

export async function reserveDiscountUse(input: {
  offer: DiscountOffer;
  accountId: string;
  idempotencyKey: string;
  now: string;
  amountCents: number;
  baseCents: number;
  subjectKind: string;
  subjectId: string;
  quoteRef?: string;
  context: Omit<QuoteContext, "priorUses" | "accountId" | "now">;
}) {
  try {
    return await prisma.$transaction(async (tx) => {
      const replay = await tx.discountReservation.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (replay) return { ok: true as const, kind: "replay" as const, reservation: asReservation(replay) };
      await tx.$executeRaw`SELECT "id" FROM "DiscountOffer" WHERE "id" = ${input.offer.id} FOR UPDATE`;
      const locked = await tx.discountOffer.findUnique({ where: { id: input.offer.id } });
      if (!locked) return { ok: false as const, reason: "This code is not valid." };
      const priorUses = await tx.discountReservation.count({
        where: { offerId: locked.id, payerAccountId: input.accountId, status: { in: ["reserved", "consumed"] } },
      });
      const decision = reserveDecision({
        offer: asOffer(locked),
        now: input.now,
        accountId: input.accountId,
        priorUses,
        idempotencyKey: input.idempotencyKey,
        existing: null,
        context: input.context,
      });
      if (!decision.ok) return decision;
      const created = await tx.discountReservation.create({
        data: {
          offerId: locked.id,
          offerVersion: locked.version,
          payerAccountId: input.accountId,
          subjectKind: input.subjectKind,
          subjectId: input.subjectId,
          idempotencyKey: input.idempotencyKey,
          status: "reserved",
          charge: input.offer.productCharge,
          currency: input.offer.currency,
          amountCents: input.amountCents,
          baseCents: input.baseCents,
          quoteRef: input.quoteRef ?? "",
          lineLabel: input.offer.productCharge,
          providerOutcome: "none",
        },
      });
      await tx.discountOffer.update({ where: { id: locked.id }, data: { reservedCount: { increment: 1 } } });
      return { ok: true as const, kind: "created" as const, reservation: asReservation(created) };
    });
  } catch {
    return { ok: false as const, reason: unavailable };
  }
}

export async function releaseDiscountByKey(idempotencyKey: string, outcome: "abandoned" | "cancelled") {
  try {
    const row = await prisma.discountReservation.findUnique({ where: { idempotencyKey } });
    if (!row) return { ok: true as const };
    return releaseDiscountReservation(row.id, outcome);
  } catch {
    return { ok: false as const, reason: unavailable };
  }
}

export async function releaseDiscountReservation(id: string, outcome: "abandoned" | "cancelled") {
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.discountReservation.findUnique({ where: { id } });
      if (!row || row.status !== "reserved") return { ok: false as const, reason: "This use is not an open reservation." };
      if (row.providerOutcome === "unknown" || row.providerOutcome === "confirmed") {
        return { ok: false as const, reason: "Reconcile the provider before releasing this reservation." };
      }
      await tx.discountReservation.update({
        where: { id },
        data: { status: "released", providerOutcome: outcome, releasedAt: new Date() },
      });
      await tx.discountOffer.update({ where: { id: row.offerId }, data: { reservedCount: { decrement: 1 } } });
      return { ok: true as const };
    });
  } catch {
    return { ok: false as const, reason: unavailable };
  }
}

export async function consumeDiscountReservation(input: {
  id?: string;
  idempotencyKey?: string;
  settlementId: string;
  providerConfirmed: boolean;
  adjustment?: DiscountAdjustment;
}) {
  const decisionPreview = consumeDecision({
    reservation: { id: "", offerId: "", version: 0, accountId: "", idempotencyKey: "", status: "reserved", amountCents: 0, settlementId: "", refundedAt: "", providerOutcome: "none" },
    settlementId: input.settlementId,
    providerConfirmed: input.providerConfirmed,
  });
  if (!input.providerConfirmed) return decisionPreview;
  try {
    return await prisma.$transaction(async (tx) => {
      const row = input.id
        ? await tx.discountReservation.findUnique({ where: { id: input.id } })
        : await tx.discountReservation.findUnique({ where: { idempotencyKey: input.idempotencyKey ?? "" } });
      const decision = consumeDecision({
        reservation: row ? asReservation(row) : null,
        settlementId: input.settlementId,
        providerConfirmed: true,
      });
      if (!decision.ok || decision.kind === "replay" || !row) return decision;
      const consumed = await tx.discountReservation.update({
        where: { id: row.id },
        data: { status: "consumed", settlementId: input.settlementId, providerOutcome: "confirmed", consumedAt: new Date() },
      });
      await tx.discountOffer.update({
        where: { id: row.offerId },
        data: { reservedCount: { decrement: 1 }, redeemedCount: { increment: 1 } },
      });
      if (input.adjustment) {
        await tx.discountAdjustment.create({
          data: {
            reservationId: row.id,
            quoteRef: input.adjustment.quoteRef,
            lineLabel: input.adjustment.line,
            payerAccountId: input.adjustment.payerAccountId,
            offerId: input.adjustment.offerId,
            offerVersion: input.adjustment.version,
            currency: input.adjustment.currency,
            amountCents: input.adjustment.discountCents,
            baseCents: input.adjustment.originalCents,
          },
        });
      }
      return { ok: true as const, kind: "consumed" as const, reservation: asReservation(consumed), moneyMoved: false as const, payoutPaid: false as const };
    });
  } catch {
    return { ok: false as const, reason: unavailable, moneyMoved: false as const, payoutPaid: false as const };
  }
}

export async function discountUsageReport() {
  try {
    const [offers, reservations] = await Promise.all([
      prisma.discountOffer.findMany(),
      prisma.discountReservation.findMany(),
    ]);
    const rows = [
      ...offers.map((offer) => ({
        charge: offer.productCharge as ProductCharge,
        currency: offer.currency,
        state: "issued" as const,
        amountCents: 0,
      })),
      ...reservations.map((row) => ({
        charge: row.charge as ProductCharge,
        currency: row.currency,
        state: (row.refundedAt ? "refunded" : row.status === "consumed" ? "redeemed" : row.status === "reserved" ? "reserved" : "issued") as
          | "issued"
          | "reserved"
          | "redeemed"
          | "refunded",
        amountCents: row.amountCents,
      })),
    ];
    return discountReport(rows.filter((row) => row.state !== "issued" || row.amountCents === 0));
  } catch {
    return [];
  }
}

async function agreementDiscountKeys(documentId: string) {
  const { readSignedTermsSnapshot } = await import("@/lib/signed-funding");
  const { readDiscountAdjustments } = await import("@/lib/discount-codes");
  const document = await prisma.contractDocument.findUnique({
    where: { id: documentId },
    select: { termsSnapshotJson: true },
  });
  const terms = document ? readSignedTermsSnapshot(document.termsSnapshotJson) : null;
  const plan = terms?.financialPlan;
  const quote = plan && typeof plan === "object" ? (plan as { signedQuote?: { discountReservationKeys?: unknown } }).signedQuote : null;
  const keys = new Set<string>();
  if (Array.isArray(quote?.discountReservationKeys)) {
    for (const key of quote.discountReservationKeys) {
      if (typeof key === "string" && key.trim()) keys.add(key);
    }
  }
  for (const row of readDiscountAdjustments(plan)) {
    const role = row.charge === "business_collaboration_fee" ? "business" : "influencer";
    keys.add(`collaboration:${documentId}:${role}:${row.code}`);
  }
  return { keys: [...keys], adjustments: readDiscountAdjustments(plan) };
}

export async function releaseAgreementDiscountReservations(documentId: string) {
  try {
    const { keys } = await agreementDiscountKeys(documentId);
    for (const key of keys) await releaseDiscountByKey(key, "cancelled");
    const rows = await prisma.discountReservation.findMany({ where: { subjectId: documentId, status: "reserved" } });
    for (const row of rows) await releaseDiscountReservation(row.id, "cancelled");
    return { ok: true as const };
  } catch {
    return { ok: false as const, reason: unavailable };
  }
}

export async function consumeAgreementDiscountReservations(documentId: string, settlementId: string) {
  try {
    const { keys, adjustments } = await agreementDiscountKeys(documentId);
    for (const key of keys) {
      const adjustment = adjustments.find((row) => key.endsWith(`:${row.code}`) || key.includes(row.code));
      await consumeDiscountReservation({
        idempotencyKey: key,
        settlementId: `${settlementId}:${key}`,
        providerConfirmed: true,
        adjustment,
      });
    }
    return { ok: true as const, moneyMoved: false as const, payoutPaid: false as const };
  } catch {
    return { ok: false as const, reason: unavailable, moneyMoved: false as const, payoutPaid: false as const };
  }
}

export function describeOffer(offer: DiscountOffer, now = new Date().toISOString()) {
  const value = offer.kind === "percentage" ? `${(offer.percentBps ?? 0) / 100}%` : `${offer.currency} ${(offer.fixedCents ?? 0) / 100}`;
  return { status: offerStatus(offer, now), value };
}
