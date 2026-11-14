"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession, hasPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { saveRouteDraft, saveTaxConfiguration } from "@/lib/payment-standard-store";
import { planCountryTaxRule, storedFamily, type ChargeFamily } from "@/lib/country-tax";
import { planTaxConfiguration, parseMoneyToCents, parseTaxPercent, percentToStoredRate, type PreviewDecision } from "@/lib/tax-configuration";
import { accountsForSelection, countryRegions, loadTaxCatalog, previewConfiguredTax } from "@/lib/tax-settings";
import { requestStripeTaxRegistrations, stripeCredentials } from "@/lib/stripe-admin";
import { BILLING_CATALOG } from "@/lib/billing";

function gate(next: string) {
  return getAdminSession().then((session) => {
    if (!session || !hasPermission(session, "collab_finance.manage")) redirect(`/admin/login?next=${encodeURIComponent(next)}`);
    return session;
  });
}

export async function actionSaveRouteDraft(formData: FormData) {
  await gate("/admin/payment-settings?section=routes");
  const saved = await saveRouteDraft({
    countryCode: String(formData.get("countryCode") ?? ""),
    environment: String(formData.get("environment") ?? "") === "live" ? "live" : "sandbox",
    currency: String(formData.get("currency") ?? ""),
    providerCode: String(formData.get("providerCode") ?? "stripe"),
    allocatedFundsApproved: false,
    newCollectionsEnabled: false,
    releasesEnabled: formData.get("releasesEnabled") === "on",
    bankPayoutControl: formData.get("bankPayoutControl") === "on",
    evidence: String(formData.get("evidence") ?? ""),
  });
  revalidatePath("/admin/payment-settings");
  if (!saved.ok) redirect(`/admin/payment-settings?section=routes&error=${encodeURIComponent(saved.error)}`);
  redirect(`/admin/payment-settings?section=routes&saved=route&route=${saved.id}&routeTab=overview`);
}

function skuForPlanCode(code: string) {
  return BILLING_CATALOG.find((product) => product.creatorPlan === code || product.businessPlan === code)?.sku ?? "";
}

function taxForm(formData: FormData) {
  return {
    seriesName: String(formData.get("seriesName") ?? ""),
    appliesTo: String(formData.get("appliesTo") ?? ""),
    linkedIds: formData.getAll("linkedId").map((value) => String(value)),
    countryCode: String(formData.get("countryCode") ?? ""),
    regionCode: String(formData.get("regionCode") ?? ""),
    environment: String(formData.get("environment") ?? "sandbox"),
    providerCode: String(formData.get("providerCode") ?? ""),
    providerAccountId: String(formData.get("providerAccountId") ?? ""),
    calculationMethod: String(formData.get("calculationMethod") ?? ""),
    taxCategory: String(formData.get("taxCategory") ?? ""),
    priceDisplay: String(formData.get("priceDisplay") ?? "exclusive"),
    liableEntity: String(formData.get("liableEntity") ?? ""),
    registrationStatus: String(formData.get("registrationStatus") ?? "not_synced"),
    filingArrangement: String(formData.get("filingArrangement") ?? ""),
    ratePercent: String(formData.get("ratePercent") ?? ""),
    jurisdiction: String(formData.get("jurisdiction") ?? ""),
    effectiveFrom: String(formData.get("effectiveFrom") ?? ""),
    effectiveTo: String(formData.get("effectiveTo") ?? ""),
  };
}

export async function actionSaveTaxPolicy() {
  await gate("/admin/payment-settings?section=tax");
  redirect("/admin/payment-settings?section=tax&error=" + encodeURIComponent("Open the tax configuration and save it from the setup steps."));
}

export async function actionLinkFeeTaxPolicy() {
  await gate("/admin/payment-settings?section=tax");
  redirect("/admin/payment-settings?section=tax&error=" + encodeURIComponent("Choose the fee rule in the tax setup scope step."));
}

export async function actionTaxRegions(countryCode: string) {
  const session = await getAdminSession();
  if (!session || !hasPermission(session, "collab_finance.manage")) return [];
  return countryRegions(countryCode);
}

const CUSTOMER_ROLE: Record<ChargeFamily, string> = {
  subscription: "subscriber",
  business_fee: "business",
  influencer_fee: "influencer",
  influencer_service: "services",
  other: "business",
};

export async function actionSaveTaxConfiguration(formData: FormData): Promise<{ ok: true; id: string; summary?: string } | { ok: false; error: string }> {
  const session = await getAdminSession();
  if (!session || !hasPermission(session, "collab_finance.manage")) {
    return { ok: false, error: "You do not have access to tax settings." };
  }
  if (String(formData.get("ruleModel") ?? "") === "country") {
    const catalog = await loadTaxCatalog();
    const { flagRuleConflicts, mapStoredPolicy } = await import("@/lib/country-tax");
    const existing = flagRuleConflicts(catalog.records.map((record) => mapStoredPolicy(record)).filter((rule) => rule != null));
    const family = storedFamily(String(formData.get("family") ?? "")) || String(formData.get("family") ?? "");
    const planned = planCountryTaxRule({
      countryCode: String(formData.get("countryCode") ?? ""),
      family,
      chargeId: String(formData.get("chargeId") ?? ""),
      chargeLabel: String(formData.get("chargeLabel") ?? ""),
      method: String(formData.get("calculationMethod") ?? ""),
      ratePercent: String(formData.get("ratePercent") ?? ""),
      existing,
    });
    if (!planned.ok) return planned;
    const rule = planned.rule;
    const appliesTo = rule.family === "influencer_service" ? "influencer_services" : rule.family;
    const percent = rule.ratePercent == null ? null : percentToStoredRate(rule.ratePercent);
    const saved = await saveTaxConfiguration({
      name: planned.summary,
      appliesTo,
      customerRole: CUSTOMER_ROLE[rule.family],
      linkedIds: rule.chargeId ? [rule.chargeId] : [],
      countryCode: rule.countryCode,
      regionCode: "",
      environment: "sandbox",
      providerCode: "",
      providerAccountId: "",
      calculationMethod: rule.method,
      taxCategory: "",
      inclusive: false,
      liableEntity: "",
      registrationStatus: "not_synced",
      filingArrangement: "",
      filingOwner: "",
      rateBps: rule.method === "percentage" ? percent : null,
      jurisdiction: "",
      effectiveFrom: new Date(),
      effectiveTo: null,
      treatment: rule.ratePercent === 0 ? "exempt" : "taxable",
      status: "ready",
      planIds: rule.family === "subscription" && rule.chargeId ? [rule.chargeId] : [],
      feeRuleIds: rule.family === "business_fee" || rule.family === "influencer_fee" || rule.family === "other" ? (rule.chargeId ? [rule.chargeId] : []) : [],
      serviceIds: [],
      activate: true,
    });
    await prisma.auditLog.create({
      data: {
        actor: session.email,
        action: "tax.rule_saved",
        objectType: "TaxPolicyVersion",
        objectId: saved.id,
        after: { summary: planned.summary, countryCode: rule.countryCode, family: rule.family, method: rule.method, ratePercent: rule.ratePercent },
      },
    }).catch(() => null);
    revalidatePath("/admin/payment-settings");
    revalidatePath("/admin/plans");
    return { ok: true, id: saved.id, summary: planned.summary };
  }
  const form = taxForm(formData);
  const intent = String(formData.get("intent") ?? "") === "activate" ? "activate" : "draft";
  const catalog = await loadTaxCatalog();
  const allowedIds = form.appliesTo === "subscription"
    ? catalog.plans.map((plan) => plan.id)
    : form.appliesTo === "influencer_services"
      ? catalog.services.map((service) => service.id)
      : catalog.feeRules.filter((rule) => rule.purpose === form.appliesTo).map((rule) => rule.id);
  const eligibleAccounts = accountsForSelection(catalog.accounts, form.providerCode, form.environment === "live" ? "live" : "sandbox");
  const planned = planTaxConfiguration({
    ...form,
    allowedIds,
    eligibleProviders: catalog.integrations.map((item) => item.id),
    eligibleAccountIds: eligibleAccounts.map((account) => account.id),
    intent,
  });
  if (!planned.ok) return planned;
  let activationPreview: PreviewDecision | null = null;
  const previewAmount = parseMoneyToCents(String(formData.get("previewAmount") ?? ""));
  if (intent === "activate") {
    activationPreview = await previewConfiguredTax({
      audience: "admin",
      phase: "calculate",
      method: planned.planned.calculationMethod,
      amountCents: previewAmount ?? 0,
      inclusive: planned.planned.inclusive,
      taxCategory: planned.planned.taxCategory,
      rateBps: planned.planned.rateBps,
      jurisdiction: planned.planned.jurisdiction,
      liableEntity: planned.planned.liableEntity,
      country: String(formData.get("previewCountry") ?? form.countryCode),
      region: String(formData.get("previewRegion") ?? form.regionCode),
      postalCode: String(formData.get("previewPostal") ?? ""),
      line1: "",
      city: "",
      requireStreet: false,
      subjectSelected: planned.planned.linkedIds.includes(String(formData.get("previewSubject") ?? "").trim()),
    });
    if (!activationPreview.ok || activationPreview.taxCents == null) {
      return { ok: false, error: activationPreview.correction || activationPreview.customerMessage };
    }
  }
  const selectedPlans = catalog.plans.filter((plan) => planned.planned.planIds.includes(plan.id));
  const linkedIds = planned.planned.appliesTo === "subscription"
    ? [...new Set(selectedPlans.flatMap((plan) => [plan.id, plan.code, skuForPlanCode(plan.code)].filter(Boolean)))]
    : planned.planned.linkedIds;
  const saved = await saveTaxConfiguration({
    ...planned.planned,
    linkedIds,
    planIds: selectedPlans.map((plan) => plan.id),
    activate: intent === "activate",
  });
  if (activationPreview) {
    await prisma.taxPreviewRun.create({
      data: {
        policyName: planned.planned.name,
        appliesTo: planned.planned.appliesTo,
        subjectId: planned.planned.linkedIds[0] ?? "",
        amountCents: previewAmount ?? 0,
        taxCents: activationPreview.taxCents,
        totalCents: activationPreview.totalCents,
        countryCode: String(formData.get("previewCountry") ?? ""),
        regionCode: String(formData.get("previewRegion") ?? ""),
        postalCode: String(formData.get("previewPostal") ?? ""),
        ok: true,
        reason: activationPreview.reason,
        correction: "",
        liableEntity: planned.planned.liableEntity,
      },
    }).catch(() => null);
  }
  revalidatePath("/admin/payment-settings");
  revalidatePath("/admin/plans");
  return { ok: true, id: saved.id };
}

export async function actionPreviewTaxConfiguration(formData: FormData) {
  const session = await getAdminSession();
  if (!session || !hasPermission(session, "collab_finance.manage")) {
    return { ok: false as const, error: "You do not have access to tax settings." };
  }
  const form = taxForm(formData);
  const amountCents = parseMoneyToCents(String(formData.get("previewAmount") ?? ""));
  const percent = parseTaxPercent(form.ratePercent);
  const decision = await previewConfiguredTax({
    audience: "admin",
    phase: "calculate",
    method: form.calculationMethod,
    amountCents: amountCents ?? 0,
    inclusive: form.priceDisplay === "inclusive",
    taxCategory: form.taxCategory,
    rateBps: form.calculationMethod === "manual" && percent != null ? percentToStoredRate(percent) : null,
    jurisdiction: form.jurisdiction,
    liableEntity: form.liableEntity,
    country: String(formData.get("previewCountry") ?? ""),
    region: String(formData.get("previewRegion") ?? ""),
    postalCode: String(formData.get("previewPostal") ?? ""),
    line1: "",
    city: "",
    requireStreet: false,
    subjectSelected: form.linkedIds.includes(String(formData.get("previewSubject") ?? "").trim()),
  });
  await prisma.taxPreviewRun.create({
    data: {
      policyName: form.seriesName,
      appliesTo: form.appliesTo,
      subjectId: form.linkedIds[0] ?? "",
      amountCents: amountCents ?? 0,
      taxCents: decision.kind === "calculated" ? decision.taxCents : null,
      totalCents: decision.kind === "calculated" ? decision.totalCents : null,
      countryCode: String(formData.get("previewCountry") ?? ""),
      regionCode: String(formData.get("previewRegion") ?? ""),
      postalCode: String(formData.get("previewPostal") ?? ""),
      ok: decision.ok,
      reason: decision.reason,
      correction: decision.correction,
      liableEntity: form.liableEntity,
    },
  }).catch(() => null);
  revalidatePath("/admin/payment-settings");
  return decision;
}

export async function actionSyncTaxRegistration(formData: FormData) {
  const session = await getAdminSession();
  if (!session || !hasPermission(session, "collab_finance.manage")) return { status: "unavailable" as const };
  const id = String(formData.get("policyId") ?? "").trim();
  const creds = await stripeCredentials();
  const status = creds.ok ? await requestStripeTaxRegistrations(creds.secret) : "unavailable";
  if (id && !id.startsWith("missing:")) {
    await prisma.taxPolicyVersion.update({ where: { id }, data: { registrationStatus: status } }).catch(() => null);
  }
  revalidatePath("/admin/payment-settings");
  return { status };
}

export async function actionSavePlanTax(formData: FormData) {
  const session = await getAdminSession();
  if (!session || !hasPermission(session, "plans.edit")) redirect("/admin/login?next=/admin/plans");
  const id = String(formData.get("planId") ?? "").trim();
  const taxBehavior = String(formData.get("taxBehavior") ?? "").trim();
  if (taxBehavior && taxBehavior !== "exclusive" && taxBehavior !== "inclusive") {
    redirect("/admin/plans?error=" + encodeURIComponent("Tax behaviour is exclusive, inclusive, or left unset."));
  }
  await prisma.entitlementPlan.update({
    where: { id },
    data: {
      taxCode: String(formData.get("taxCode") ?? "").trim(),
      taxBehavior,
      taxPolicyId: String(formData.get("taxPolicyId") ?? "").trim(),
    },
  });
  revalidatePath("/admin/plans");
  redirect("/admin/plans?saved=tax");
}

export async function actionRecheckVerification(formData: FormData) {
  const { getAccountSession } = await import("@/lib/accounts");
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/account/verification");
  const checkKey = String(formData.get("checkKey") ?? "").trim();
  const role = String(formData.get("role") ?? "paying_business");
  if (!checkKey) redirect("/account/verification?error=" + encodeURIComponent("Choose a verification task."));
  await prisma.paymentVerificationTask.upsert({
    where: { userId_role_checkKey: { userId: account.id, role, checkKey } },
    create: { userId: account.id, role, checkKey, status: "in_review", ownerLabel: "Influrios review" },
    update: { status: "in_review" },
  });
  revalidatePath("/account/verification");
  redirect("/account/verification?rechecked=1");
}
