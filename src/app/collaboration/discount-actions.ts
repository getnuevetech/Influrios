"use server";

import { getAccountSession } from "@/lib/accounts";
import { applyPricedDiscountToPlan, businessQuoteLines, influencerQuoteLines, normalizeDiscountCode, priceCollaboration, readDiscountAdjustments, rejectDiscountChange } from "@/lib/discount-codes";
import { customerUseCount, findDiscountOffer, releaseDiscountByKey, reserveDiscountUse } from "@/lib/discount-store";
import { resolvePartyPlatformFee } from "@/lib/dual-platform-fees";
import { prisma } from "@/lib/db";
import { readSignedTermsSnapshot } from "@/lib/signed-funding";
import { loadCountryRules } from "@/lib/tax-settings";

export async function actionPreviewCollaborationDiscount(input: {
  code: string;
  role: "business" | "influencer";
  grossCents: number;
  countryCode: string;
  currency: string;
  serviceLevel: string;
}) {
  const account = await getAccountSession();
  const typedCode = input.code;
  if (!account) return { ok: false as const, typedCode, reason: "Sign in to apply a code.", moneyMoved: false as const };
  if (!Number.isInteger(input.grossCents) || input.grossCents <= 0) {
    return { ok: false as const, typedCode, reason: "Enter the gross compensation before applying a code.", moneyMoved: false as const };
  }
  const business = await resolvePartyPlatformFee(
    { jurisdiction: input.countryCode, serviceLevel: input.serviceLevel, grossValueCents: input.grossCents },
    "business",
  ).catch(() => null);
  const influencer = await resolvePartyPlatformFee(
    { jurisdiction: input.countryCode, serviceLevel: input.serviceLevel, grossValueCents: input.grossCents },
    "influencer",
  ).catch(() => null);
  if (!business?.ok || !influencer?.ok) {
    return { ok: false as const, typedCode, reason: business && !business.ok ? business.error : "The fee rule could not be quoted.", moneyMoved: false as const };
  }
  const offer = normalizeDiscountCode(typedCode) ? await findDiscountOffer(typedCode) : null;
  const prior = offer ? await customerUseCount(offer.id, account.id) : 0;
  const rules = await loadCountryRules().catch(() => []);
  const priced = priceCollaboration({
    grossCents: business.grossInfluencerCompensationCents,
    businessFeeCents: business.feeCents,
    influencerFeeCents: influencer.feeCents,
    weightsBps: [10_000],
    businessTyped: input.role === "business" ? typedCode : "",
    influencerTyped: input.role === "influencer" ? typedCode : "",
    businessOffer: input.role === "business" ? offer : null,
    influencerOffer: input.role === "influencer" ? offer : null,
    countryCode: input.countryCode,
    currency: input.currency,
    serviceLevel: input.serviceLevel,
    accountId: account.id,
    at: new Date().toISOString(),
    rules,
    priorBusinessUses: input.role === "business" ? prior : 0,
    priorInfluencerUses: input.role === "influencer" ? prior : 0,
  });
  if (!priced.ok) return { ok: false as const, typedCode, reason: "reason" in priced ? priced.reason : priced.error, moneyMoved: false as const };
  const businessTax = priced.businessPaysCents - priced.beforeTaxBusinessPaysCents;
  const influencerTax = priced.influencerReceivesBeforeTaxCents - priced.influencerNetCents;
  const lines = input.role === "business"
    ? businessQuoteLines({
        grossCents: priced.grossCents,
        businessFeeCents: priced.businessFeeCents,
        discountCents: priced.businessDiscountCents,
        taxCents: businessTax,
        youPayCents: priced.businessPaysCents,
      })
    : influencerQuoteLines({
        grossCents: priced.grossCents,
        influencerFeeCents: priced.influencerFeeCents,
        savingsCents: priced.influencerSavingsCents,
        taxCents: influencerTax,
        netCents: priced.influencerNetCents,
      });
  return { ok: true as const, code: normalizeDiscountCode(typedCode), lines, moneyMoved: false as const, payoutPaid: false as const };
}

export async function assertDiscountStillEditable(signedPartyCount: number) {
  return rejectDiscountChange({ signedPartyCount });
}

function storedAmount(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

export async function actionApplyDocumentDiscount(input: { documentId: string; code: string; role: "business" | "influencer" }) {
  const account = await getAccountSession();
  const typedCode = input.code;
  if (!account) return { ok: false as const, typedCode, reason: "Sign in to apply a code.", moneyMoved: false as const };
  const document = await prisma.contractDocument.findUnique({
    where: { id: input.documentId },
    include: { parties: true },
  }).catch(() => null);
  if (!document) return { ok: false as const, typedCode, reason: "This agreement was not found.", moneyMoved: false as const };
  const party = document.parties.find((row) => row.userId === account.id || row.email.toLowerCase() === account.email.toLowerCase());
  if (!party || (input.role === "business" ? party.role !== "business" : party.role === "business")) {
    return { ok: false as const, typedCode, reason: "Only that side of the agreement can apply this code.", moneyMoved: false as const };
  }
  const signedPartyCount = document.parties.filter((row) => row.status === "signed").length;
  const editable = rejectDiscountChange({ signedPartyCount });
  if (!editable.ok) return { ok: false as const, typedCode, reason: editable.reason, readOnly: true as const, moneyMoved: false as const };
  const terms = readSignedTermsSnapshot(document.termsSnapshotJson);
  const plan = terms?.financialPlan;
  const quote = plan && typeof plan.signedQuote === "object" ? (plan.signedQuote as Record<string, unknown>) : null;
  const grossCents = storedAmount(quote?.grossInfluencerCompensationCents);
  const businessFeeCents = storedAmount(quote?.businessPlatformFeeCents);
  const influencerFeeCents = storedAmount(quote?.influencerPlatformFeeCents);
  if (!terms || !plan || !quote || grossCents == null || businessFeeCents == null || influencerFeeCents == null) {
    return { ok: false as const, typedCode, reason: "This agreement has no fee breakdown yet.", moneyMoved: false as const };
  }
  const weights = terms.milestones.map((row) => row.shareBps);
  const existing = readDiscountAdjustments(plan);
  const businessAdjustment = existing.find((row) => row.charge === "business_collaboration_fee");
  const influencerAdjustment = existing.find((row) => row.charge === "influencer_collaboration_fee");
  const businessBase = businessAdjustment?.originalCents ?? businessFeeCents;
  const influencerBase = influencerAdjustment?.originalCents ?? influencerFeeCents;
  const offer = await findDiscountOffer(typedCode);
  const keptBusiness = input.role === "influencer" ? businessAdjustment : null;
  const keptInfluencer = input.role === "business" ? influencerAdjustment : null;
  const keptBusinessOffer = keptBusiness ? await findDiscountOffer(keptBusiness.code) : null;
  const keptInfluencerOffer = keptInfluencer ? await findDiscountOffer(keptInfluencer.code) : null;
  if ((keptBusiness && !keptBusinessOffer) || (keptInfluencer && !keptInfluencerOffer)) {
    return { ok: false as const, typedCode, reason: "The other side’s code could not be loaded. Nothing was changed.", moneyMoved: false as const };
  }
  const prior = offer ? await customerUseCount(offer.id, account.id) : 0;
  const rules = await loadCountryRules().catch(() => []);
  const priced = priceCollaboration({
    grossCents,
    businessFeeCents: businessBase,
    influencerFeeCents: influencerBase,
    weightsBps: weights,
    businessTyped: input.role === "business" ? typedCode : keptBusiness?.code ?? "",
    influencerTyped: input.role === "influencer" ? typedCode : keptInfluencer?.code ?? "",
    businessOffer: input.role === "business" ? offer : keptBusinessOffer,
    influencerOffer: input.role === "influencer" ? offer : keptInfluencerOffer,
    countryCode: terms.jurisdictionCode,
    currency: terms.currency,
    serviceLevel: terms.feeServiceLevel || terms.serviceLevel,
    accountId: account.id,
    at: new Date().toISOString(),
    rules,
    priorBusinessUses: input.role === "business" ? prior : 0,
    priorInfluencerUses: input.role === "influencer" ? prior : 0,
    quoteRef: document.id,
  });
  if (!priced.ok || !offer) return { ok: false as const, typedCode, reason: priced.ok ? "This code is not valid." : "reason" in priced ? priced.reason : priced.error, moneyMoved: false as const };
  const next = applyPricedDiscountToPlan(plan, priced);
  if (!next.ok) return { ok: false as const, typedCode, reason: next.error, moneyMoved: false as const };
  const code = normalizeDiscountCode(typedCode);
  const previous = existing.find((row) => row.charge === (input.role === "business" ? "business_collaboration_fee" : "influencer_collaboration_fee"));
  if (previous && previous.code !== code) {
    await releaseDiscountByKey(`collaboration:${document.id}:${input.role}:${previous.code}`, "abandoned");
  }
  const reserved = await reserveDiscountUse({
    offer,
    accountId: account.id,
    idempotencyKey: `collaboration:${document.id}:${input.role}:${code}`,
    now: new Date().toISOString(),
    amountCents: input.role === "business" ? priced.businessDiscountCents : priced.influencerSavingsCents,
    baseCents: input.role === "business" ? priced.businessFeeCents : priced.influencerFeeCents,
    subjectKind: "collaboration_agreement",
    subjectId: document.id,
    quoteRef: document.id,
    context: {
      charge: input.role === "business" ? "business_collaboration_fee" : "influencer_collaboration_fee",
      countryCode: terms.jurisdictionCode,
      currency: terms.currency,
      serviceLevel: terms.feeServiceLevel || terms.serviceLevel,
    },
  });
  if (!reserved.ok) return { ok: false as const, typedCode, reason: reserved.reason, moneyMoved: false as const };
  const signed = next.plan.signedQuote;
  if (signed && typeof signed === "object") {
    const record = signed as { discountReservationKeys?: string[] };
    const previousKey = previous ? `collaboration:${document.id}:${input.role}:${previous.code}` : "";
    record.discountReservationKeys = [...(record.discountReservationKeys ?? []).filter((key) => key !== previousKey), reserved.reservation.idempotencyKey];
  }
  try {
    await prisma.contractDocument.update({
      where: { id: document.id },
      data: { termsSnapshotJson: { ...terms, financialPlan: next.plan } as object },
    });
  } catch {
    if (reserved.kind === "created") {
      const { releaseDiscountReservation } = await import("@/lib/discount-store");
      await releaseDiscountReservation(reserved.reservation.id, "abandoned");
    }
    return { ok: false as const, typedCode, reason: "The agreement could not be updated. Nothing was charged.", moneyMoved: false as const };
  }
  const businessTax = priced.businessPaysCents - priced.beforeTaxBusinessPaysCents;
  const influencerTax = priced.influencerReceivesBeforeTaxCents - priced.influencerNetCents;
  const lines = input.role === "business"
    ? businessQuoteLines({
        grossCents: priced.grossCents,
        businessFeeCents: priced.businessFeeCents,
        discountCents: priced.businessDiscountCents,
        taxCents: businessTax,
        youPayCents: priced.businessPaysCents,
      })
    : influencerQuoteLines({
        grossCents: priced.grossCents,
        influencerFeeCents: priced.influencerFeeCents,
        savingsCents: priced.influencerSavingsCents,
        taxCents: influencerTax,
        netCents: priced.influencerNetCents,
      });
  return { ok: true as const, code, lines, moneyMoved: false as const, payoutPaid: false as const };
}

export async function actionRemoveDocumentDiscount(input: { documentId: string; role: "business" | "influencer"; code: string }) {
  const account = await getAccountSession();
  if (!account) return { ok: false as const, reason: "Sign in to remove a code." };
  const document = await prisma.contractDocument.findUnique({ where: { id: input.documentId }, include: { parties: true } }).catch(() => null);
  if (!document) return { ok: false as const, reason: "This agreement was not found." };
  const signedPartyCount = document.parties.filter((row) => row.status === "signed").length;
  const editable = rejectDiscountChange({ signedPartyCount });
  if (!editable.ok) return { ok: false as const, reason: editable.reason, readOnly: true as const };
  const terms = readSignedTermsSnapshot(document.termsSnapshotJson);
  const plan = terms?.financialPlan;
  const quote = plan && typeof plan.signedQuote === "object" ? (plan.signedQuote as Record<string, unknown>) : null;
  const existing = plan ? readDiscountAdjustments(plan) : [];
  const charge = input.role === "business" ? "business_collaboration_fee" : "influencer_collaboration_fee";
  const grossCents = storedAmount(quote?.grossInfluencerCompensationCents);
  const businessFeeCents = existing.find((row) => row.charge === "business_collaboration_fee")?.originalCents ?? storedAmount(quote?.businessPlatformFeeCents);
  const influencerFeeCents = existing.find((row) => row.charge === "influencer_collaboration_fee")?.originalCents ?? storedAmount(quote?.influencerPlatformFeeCents);
  if (terms && plan && grossCents != null && businessFeeCents != null && influencerFeeCents != null) {
    const rules = await loadCountryRules().catch(() => []);
    const keptBusiness = input.role === "business" ? null : existing.find((row) => row.charge === "business_collaboration_fee");
    const keptInfluencer = input.role === "influencer" ? null : existing.find((row) => row.charge === "influencer_collaboration_fee");
    const priced = priceCollaboration({
      grossCents,
      businessFeeCents: keptBusiness?.originalCents ?? businessFeeCents,
      influencerFeeCents: keptInfluencer?.originalCents ?? influencerFeeCents,
      weightsBps: terms.milestones.map((row) => row.shareBps),
      businessTyped: keptBusiness?.code ?? "",
      influencerTyped: keptInfluencer?.code ?? "",
      businessOffer: keptBusiness ? await findDiscountOffer(keptBusiness.code) : null,
      influencerOffer: keptInfluencer ? await findDiscountOffer(keptInfluencer.code) : null,
      countryCode: terms.jurisdictionCode,
      currency: terms.currency,
      serviceLevel: terms.feeServiceLevel || terms.serviceLevel,
      accountId: account.id,
      at: new Date().toISOString(),
      rules,
      quoteRef: document.id,
    });
    if (!priced.ok) return { ok: false as const, reason: "reason" in priced ? priced.reason : priced.error, moneyMoved: false as const };
    const next = applyPricedDiscountToPlan(plan, priced, [charge]);
    if (!next.ok) return { ok: false as const, reason: next.error, moneyMoved: false as const };
    await prisma.contractDocument.update({
      where: { id: document.id },
      data: { termsSnapshotJson: { ...terms, financialPlan: next.plan } as object },
    });
    await releaseDiscountByKey(`collaboration:${document.id}:${input.role}:${normalizeDiscountCode(input.code)}`, "abandoned");
    const businessTax = priced.businessPaysCents - priced.beforeTaxBusinessPaysCents;
    const influencerTax = priced.influencerReceivesBeforeTaxCents - priced.influencerNetCents;
    const lines = input.role === "business"
      ? businessQuoteLines({
          grossCents: priced.grossCents,
          businessFeeCents: priced.businessFeeCents,
          discountCents: priced.businessDiscountCents,
          taxCents: businessTax,
          youPayCents: priced.businessPaysCents,
        })
      : influencerQuoteLines({
          grossCents: priced.grossCents,
          influencerFeeCents: priced.influencerFeeCents,
          savingsCents: priced.influencerSavingsCents,
          taxCents: influencerTax,
          netCents: priced.influencerNetCents,
        });
    return { ok: true as const, lines, moneyMoved: false as const };
  }
  return { ok: false as const, reason: "This agreement has no fee breakdown yet.", moneyMoved: false as const };
}
