"use server";

import { revalidatePath } from "next/cache";
import { getAdminSession, hasPermission, type AdminSession } from "@/lib/admin-auth";
import { parseOfferDraft, sampleDiscount, type DiscountKind } from "@/lib/discount-codes";
import { calculateCountryTax, type CountryTaxRule } from "@/lib/country-tax";
import { saveDiscountOffer, setDiscountLifecycle } from "@/lib/discount-store";
import { loadCountryRules } from "@/lib/tax-settings";

function canIssue(session: AdminSession | null) {
  return Boolean(session && hasPermission(session, "discounts.manage"));
}

export async function actionSaveDiscountCode(formData: FormData) {
  const session = await getAdminSession();
  if (!canIssue(session)) return { ok: false as const, error: "You can view discount codes. Issuing or pausing them needs the “Manage discount codes” feature." };
  const parsed = parseOfferDraft({
    code: String(formData.get("code") ?? ""),
    productCharge: String(formData.get("productCharge") ?? ""),
    kind: String(formData.get("kind") ?? ""),
    value: String(formData.get("value") ?? ""),
    currency: String(formData.get("currency") ?? "USD"),
    countryCode: String(formData.get("countryCode") ?? ""),
    planCode: String(formData.get("planCode") ?? ""),
    planName: String(formData.get("planName") ?? ""),
    billingInterval: String(formData.get("billingInterval") ?? ""),
    serviceLevel: String(formData.get("serviceLevel") ?? ""),
    startsAt: String(formData.get("startsAt") ?? ""),
    endsAt: String(formData.get("endsAt") ?? ""),
    totalUses: String(formData.get("totalUses") ?? ""),
    usesPerCustomer: String(formData.get("usesPerCustomer") ?? "1"),
  });
  if (!parsed.ok) return parsed;
  const lifecycle = formData.get("intent") === "activate" ? "active" : "draft";
  const saved = await saveDiscountOffer({
    actorId: session?.userId ?? "",
    existingId: String(formData.get("offerId") ?? "").trim() || undefined,
    lifecycle,
    draft: parsed.draft,
  });
  if (!saved.ok) return saved;
  revalidatePath("/admin/payment-settings");
  return { ok: true as const };
}

export async function actionPauseDiscountCode(formData: FormData) {
  const session = await getAdminSession();
  if (!canIssue(session)) return { ok: false as const, error: "You can view discount codes. Pausing them needs finance or commerce manage access." };
  const saved = await setDiscountLifecycle({
    id: String(formData.get("offerId") ?? ""),
    actorId: session?.userId ?? "",
    lifecycle: "paused",
  });
  if (!saved.ok) return saved;
  revalidatePath("/admin/payment-settings");
  return { ok: true as const };
}

export async function actionPreviewDiscountSample(formData: FormData) {
  const session = await getAdminSession();
  if (!session || (!hasPermission(session, "commerce.view") && !hasPermission(session, "collab_finance.view") && !canIssue(session))) {
    return { ok: false as const, error: "Sign in to preview a discount." };
  }
  const kind = String(formData.get("kind") ?? "") as DiscountKind;
  const value = String(formData.get("value") ?? "");
  const baseCents = Number(formData.get("baseCents") ?? "0");
  const parsed = parseOfferDraft({
    code: String(formData.get("code") ?? "PREVIEW"),
    productCharge: String(formData.get("productCharge") ?? "subscription"),
    kind,
    value,
    currency: String(formData.get("currency") ?? "USD"),
    countryCode: String(formData.get("countryCode") ?? "US"),
    planCode: String(formData.get("planCode") ?? "preview"),
    planName: String(formData.get("planName") ?? "Preview"),
    billingInterval: String(formData.get("billingInterval") ?? "month"),
    serviceLevel: String(formData.get("serviceLevel") ?? "contracted"),
    startsAt: "2026-01-01",
    endsAt: "2026-12-31",
    totalUses: "1",
    usesPerCustomer: "1",
  });
  if (!parsed.ok) return parsed;
  if (!Number.isInteger(baseCents) || baseCents < 0) return { ok: false as const, error: "Choose a plan or fee before previewing." };
  if (baseCents === 0) {
    const rate = parsed.draft.kind === "percentage" ? `${(parsed.draft.percentBps ?? 0) / 100}%` : `${parsed.draft.currency} ${((parsed.draft.fixedCents ?? 0) / 100).toFixed(2)}`;
    return {
      ok: true as const,
      discountCents: 0,
      netCents: 0,
      taxCents: null,
      taxReason: `${rate} off the ${parsed.draft.productCharge === "influencer_collaboration_fee" ? "influencer" : "business"} collaboration fee. The quote uses the fee rule, then calculates tax on the discounted fee.`,
      moneyMoved: false as const,
    };
  }
  const discount = sampleDiscount({
    kind: parsed.draft.kind,
    percentBps: parsed.draft.percentBps,
    fixedCents: parsed.draft.fixedCents,
    baseCents,
  });
  if (!discount.ok) return discount;
  const netCents = baseCents - discount.discountCents;
  let taxCents: number | null = null;
  let taxReason = "";
  const rules = await loadCountryRules().catch(() => [] as CountryTaxRule[]);
  const family = parsed.draft.productCharge === "subscription" ? "subscription" : parsed.draft.productCharge === "business_collaboration_fee" ? "business_fee" : "influencer_fee";
  const taxed = calculateCountryTax({
    rules,
    family,
    chargeId: parsed.draft.productCharge === "subscription" ? parsed.draft.planCode : family,
    countryCode: parsed.draft.countryCode,
    baseCents: netCents,
    currency: parsed.draft.currency,
    at: new Date().toISOString(),
  });
  if (taxed.ok && taxed.taxCents != null) {
    taxCents = taxed.taxCents;
    taxReason = taxed.reason;
  }
  return {
    ok: true as const,
    discountCents: discount.discountCents,
    netCents,
    taxCents,
    taxReason,
    moneyMoved: false as const,
  };
}
