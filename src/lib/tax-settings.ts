/**
 * Loads tax settings and runs a preview. A preview does not open a charge.
 */
import { countryFromLocationString } from "@/lib/countries";
import { State } from "country-state-city";
import { BILLING_CATALOG, getProduct } from "@/lib/billing";
import { corridorCountries } from "@/lib/corridor-countries";
import { prisma } from "@/lib/db";
import { calculateCountryTax, dedupeCountryRules, flagRuleConflicts, mapLegacyInclusivePrice, mapStoredPolicy, matchCountryRule, paidPlanAvailability, subscriptionOffers, type CountryTaxRule } from "@/lib/country-tax";
import {
  INFLUENCER_SERVICE_SUBJECTS,
  TAX_COPY,
  accountsFor,
  billingAddressReady,
  decidePreview,
  eligiblePaymentIntegrations,
  feeRuleChoiceLabel,
  planTaxGate,
  registrationLabel,
  storedRateToPercent,
  type PlanTaxGate,
  type PreviewDecision,
  type TaxDisplayStatus,
} from "@/lib/tax-configuration";
import { requestStripeTaxCalculation, stripeCredentials } from "@/lib/stripe-admin";

export function countryRegions(countryCode: string) {
  const code = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return [];
  return (State.getStatesOfCountry(code) ?? []).map((region) => ({ code: region.isoCode, name: region.name }));
}

function splitIds(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function asMethod(value: string): "" | "automatic" | "manual" | "percentage" | "location" {
  if (value === "automatic" || value === "manual" || value === "percentage" || value === "location") return value;
  return "";
}

/** Ids that can round-trip a saved subscription plan: catalog id, plan code, and billing sku. */
export function planMatchKeys(plan: { id: string; code: string }) {
  const sku = BILLING_CATALOG.find((product) => product.creatorPlan === plan.code || product.businessPlan === plan.code)?.sku ?? "";
  return [...new Set([plan.id, plan.code, sku].map((key) => key.trim()).filter(Boolean))];
}

export async function loadTaxCatalog() {
  const [policies, plans, rules, connections, accounts, stripe, previews] = await Promise.all([
    prisma.taxPolicyVersion.findMany({ orderBy: { createdAt: "desc" }, take: 80 }).catch(() => []),
    prisma.entitlementPlan.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, code: true, name: true, amountCents: true, taxPolicyId: true, taxCode: true, taxBehavior: true } }).catch(() => []),
    prisma.collaborationFeeRule.findMany({ where: { active: true }, orderBy: { name: "asc" }, take: 80, select: { id: true, name: true, purpose: true, payer: true, taxPolicyId: true } }).catch(() => []),
    prisma.providerConnection.findMany({ select: { id: true, providerCode: true, environment: true, health: true } }).catch(() => []),
    prisma.providerAccount.findMany({ select: { id: true, connectionId: true, environment: true, accountKind: true, externalAccountId: true, legalOwnerRef: true } }).catch(() => []),
    prisma.integrationProvider.findUnique({ where: { kind_code: { kind: "payment", code: "stripe" } }, select: { enabled: true } }).catch(() => null),
    prisma.taxPreviewRun.findMany({ orderBy: { createdAt: "desc" }, take: 20 }).catch(() => []),
  ]);
  const connectionById = new Map(connections.map((connection) => [connection.id, connection]));
  const integrations = eligiblePaymentIntegrations(
    connections.map((connection) => ({
      providerCode: connection.providerCode,
      health: connection.health,
      enabled: connection.providerCode === "stripe" ? Boolean(stripe?.enabled) : false,
    })),
  );
  const accountOptions = accounts.flatMap((account) => {
    const connection = connectionById.get(account.connectionId);
    if (!connection || connection.health === "restricted") return [];
    const kind = account.accountKind === "platform" ? "Platform account" : account.accountKind === "connected" ? "Connected account" : "Provider account";
    const ref = account.legalOwnerRef.trim() || account.externalAccountId.trim();
    return [{
      id: account.id,
      label: ref ? `${kind} · ${ref}` : kind,
      providerCode: connection.providerCode,
      environment: account.environment || connection.environment,
    }];
  });
  const accountLabel = new Map(accountOptions.map((account) => [account.id, account.label]));
  const records = policies.map((policy) => ({
    id: policy.id,
    name: policy.name,
    version: policy.version,
    appliesTo: policy.appliesTo,
    linkedIds: splitIds(policy.linkedIds),
    countryCode: policy.countryCode,
    regionCode: policy.regionCode,
    environment: policy.environment === "live" ? "live" as const : "sandbox" as const,
    providerCode: policy.providerCode,
    providerAccountId: policy.providerAccountId,
    accountLabel: accountLabel.get(policy.providerAccountId) ?? "",
    calculationMethod: asMethod(policy.calculationMethod),
    taxCategory: policy.taxCategory,
    inclusive: policy.inclusive,
    liableEntity: policy.liableEntity,
    registrationStatus: policy.registrationStatus,
    registrationLabel: registrationLabel(policy.registrationStatus),
    filingArrangement: policy.filingArrangement,
    ratePercent: storedRateToPercent(policy.rateBps),
    jurisdiction: policy.jurisdiction,
    effectiveFrom: policy.effectiveFrom ? policy.effectiveFrom.toISOString().slice(0, 10) : "",
    effectiveTo: policy.effectiveTo ? policy.effectiveTo.toISOString().slice(0, 10) : "",
    status: policy.status,
    hasEffectiveFrom: Boolean(policy.effectiveFrom),
    rateBps: policy.rateBps,
  }));
  return {
    records,
    plans: plans.map((plan) => ({ id: plan.id, code: plan.code, name: plan.name, amountCents: plan.amountCents, taxPolicyId: plan.taxPolicyId })),
    feeRules: [
      ...rules
        .filter((rule) => rule.purpose === "business_platform_fee" || rule.purpose === "influencer_platform_fee")
        .map((rule) => {
          const purpose = rule.purpose === "business_platform_fee" ? "business_fee" as const : "influencer_fee" as const;
          return { id: rule.id, label: feeRuleChoiceLabel(rule.name, purpose), purpose };
        }),
      ...rules
        .filter((rule) => rule.purpose !== "business_platform_fee" && rule.purpose !== "influencer_platform_fee" && rule.name.trim())
        .map((rule) => ({ id: rule.id, label: rule.name.trim(), purpose: "other" as const })),
    ],
    services: INFLUENCER_SERVICE_SUBJECTS.map((item) => ({ id: item.id, label: item.label })),
    countries: corridorCountries().map((country) => ({ code: country.code, name: country.name })),
    integrations,
    accounts: accountOptions,
    previews: previews.map((preview) => ({
      id: preview.id,
      appliesTo: preview.appliesTo,
      ok: preview.ok,
      reason: preview.reason,
      correction: preview.correction,
      taxCents: preview.taxCents,
      totalCents: preview.totalCents,
      amountCents: preview.amountCents,
      createdAt: preview.createdAt.toISOString(),
    })),
    rawPlans: plans,
  };
}

export async function subscriptionTaxGates(
  plans: { code: string; sku: string; amountCents: number; checkout: boolean }[],
  countryCode = "US",
): Promise<Record<string, PlanTaxGate>> {
  const catalog = await loadTaxCatalog().catch(() => null);
  const saved = catalog?.rawPlans ?? [];
  const rules = await loadCountryRules().catch(() => []);
  const offers = subscriptionOffers({
    countryCode,
    rules,
    plans: plans.map((plan) => {
      const product = getProduct(plan.sku);
      const code = product?.creatorPlan || product?.businessPlan || plan.code;
      const row = saved.find((item) => item.code === code || item.code === plan.code || item.id === plan.code);
      return {
        code: plan.code,
        amountCents: plan.amountCents,
        checkout: plan.checkout,
        keys: [plan.code, plan.sku, code, row?.id ?? "", row?.code ?? ""].filter(Boolean),
      };
    }),
  });
  const gates: Record<string, PlanTaxGate> = {};
  for (const offer of offers) {
    if (offer.kind === "free") {
      gates[offer.code] = {
        kind: "free",
        cancelsPaidSubscription: false,
        baseCents: offer.baseCents,
        taxCents: 0,
        totalCents: offer.totalCents,
        ratePercent: null,
      };
      continue;
    }
    if (offer.kind === "unavailable") {
      gates[offer.code] = { kind: "unavailable", message: TAX_COPY.unavailable, missing: offer.missing };
      continue;
    }
    gates[offer.code] = {
      kind: "checkout",
      message: TAX_COPY.atCheckout,
      baseCents: offer.baseCents,
      taxCents: offer.taxCents,
      totalCents: offer.totalCents,
      ratePercent: offer.ratePercent,
    };
  }
  return gates;
}

/** The member's profile country (the one source of country). Blank when the profile has none. */
export function memberBillingCountry(input: { location?: string | null; verifiedCountryCode?: string | null }) {
  const profile = countryFromLocationString(input.location)?.code;
  if (profile) return profile;
  const verified = (input.verifiedCountryCode ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(verified) ? verified : "";
}

/** Country rules and the ids that match each plan. Card tax uses these with the interval price. */
export async function loadSubscriptionTaxInputs(): Promise<{
  rules: CountryTaxRule[];
  keysByCode: Record<string, string[]>;
}> {
  const [rules, catalog] = await Promise.all([
    loadCountryRules().catch(() => [] as CountryTaxRule[]),
    loadTaxCatalog().catch(() => null),
  ]);
  const keysByCode: Record<string, string[]> = {};
  for (const plan of catalog?.plans ?? []) {
    keysByCode[plan.code] = planMatchKeys(plan);
  }
  return { rules, keysByCode };
}

export async function loadCountryRules() {
  const catalog = await loadTaxCatalog().catch(() => null);
  const mapped = (catalog?.records ?? [])
    .filter((record) => record.status !== "replaced")
    .map((record) => mapStoredPolicy(record))
    .filter((rule) => rule != null);
  return flagRuleConflicts(dedupeCountryRules(mapped));
}

export async function subscriptionCheckoutContext(sku: string, countryCode = "") {
  const product = getProduct(sku);
  const code = product?.creatorPlan || product?.businessPlan || sku;
  const plan = await prisma.entitlementPlan.findFirst({
    where: { OR: [{ code: sku }, { id: sku }, { code }] },
    select: { id: true, code: true, name: true, amountCents: true, taxPolicyId: true },
  }).catch(() => null);
  const amountCents = plan?.amountCents ?? product?.amountCents ?? 0;
  const checkout = amountCents > 0;
  const rules = await loadCountryRules().catch(() => []);
  const planId = plan?.id || plan?.code || code;
  const chargeKeys = [plan?.id ?? "", plan?.code ?? "", sku, code].filter(Boolean);
  const gate = countryCode
    ? paidPlanAvailability({ amountCents, checkout, countryCode, planId, chargeKeys, rules })
    : planTaxGate({ amountCents, checkout, gaps: [] });
  const matched = countryCode ? matchCountryRule(rules, { countryCode, family: "subscription", chargeId: planId, chargeKeys }) : null;
  const rule = matched && matched.ok ? matched.rule : null;
  const catalog = await loadTaxCatalog().catch(() => null);
  const policy = catalog?.records.find((row) => row.id === rule?.id) ?? catalog?.records.find((row) => row.id === plan?.taxPolicyId && (row.status === "ready" || row.status === "active") && row.appliesTo === "subscription") ?? null;
  return { gate, plan, amountCents, policy, rule };
}

export async function notifyTaxGap(input: { planCode: string; missing: string }) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const existing = await prisma.auditLog.findFirst({
    where: { action: "tax.configuration_missing", objectId: input.planCode, createdAt: { gte: since } },
  }).catch(() => null);
  if (existing) return;
  await prisma.auditLog.create({
    data: {
      actor: "billing",
      action: "tax.configuration_missing",
      objectType: "EntitlementPlan",
      objectId: input.planCode,
      after: { missing: input.missing, message: "This plan is temporarily unavailable." },
    },
  }).catch(() => null);
}

export async function previewConfiguredTax(input: {
  audience: "admin" | "customer";
  phase: "offer" | "calculate";
  method: string;
  amountCents: number;
  inclusive: boolean;
  taxCategory: string;
  rateBps: number | null;
  jurisdiction: string;
  liableEntity: string;
  country: string;
  region: string;
  postalCode: string;
  line1: string;
  city: string;
  requireStreet: boolean;
  subjectSelected: boolean;
}): Promise<PreviewDecision> {
  if (input.inclusive) {
    const mapped = mapLegacyInclusivePrice({
      storedCents: input.amountCents,
      inclusive: true,
      ratePercent: input.rateBps == null ? null : Number(storedRateToPercent(input.rateBps)),
    });
    return {
      ok: true,
      kind: "calculated",
      customerMessage: mapped.taxIncludedCents === 0 ? "Tax $0.00" : "",
      correction: "",
      subtotalCents: mapped.baseCents,
      taxCents: mapped.taxIncludedCents,
      totalCents: mapped.customerTotalCents,
      reason: mapped.reason,
      liableEntityLabel: "",
      legalNote: "",
    };
  }
  if (input.method === "percentage" && input.rateBps != null && input.subjectSelected && Number.isInteger(input.amountCents) && input.amountCents >= 0) {
    const calculated = calculateCountryTax({
      rules: [{
        id: "percentage",
        version: 1,
        countryCode: input.country.trim().toUpperCase() || "US",
        family: "subscription",
        chargeId: "",
        chargeLabel: "Subscriptions",
        method: "percentage",
        ratePercent: Number(storedRateToPercent(input.rateBps)),
        inclusive: false,
        effective: true,
        conflict: false,
      }],
      chargeId: "subscription",
      family: "subscription",
      countryCode: input.country || "US",
      baseCents: input.amountCents,
      currency: "USD",
      at: new Date().toISOString(),
    });
    if (!calculated.ok || calculated.taxCents == null || calculated.totalCents == null || calculated.subtotalCents == null) {
      return {
        ok: false,
        kind: calculated.status === "missing_location" ? "address" : "configuration",
        customerMessage: calculated.status === "failed" ? "We couldn't calculate tax. Nothing was charged." : "This plan is temporarily unavailable.",
        correction: calculated.reason,
        subtotalCents: null,
        taxCents: null,
        totalCents: null,
        reason: "",
        liableEntityLabel: "",
        legalNote: "",
      };
    }
    return {
      ok: true,
      kind: "calculated",
      customerMessage: calculated.taxCents === 0 ? "Tax $0.00" : "",
      correction: "",
      subtotalCents: calculated.subtotalCents,
      taxCents: calculated.taxCents,
      totalCents: calculated.totalCents,
      reason: calculated.reason,
      liableEntityLabel: "",
      legalNote: "",
    };
  }
  const method = input.method === "location" ? "automatic" : input.method;
  const addressReady = billingAddressReady({
    country: input.country,
    region: input.region,
    postalCode: input.postalCode,
    line1: input.line1,
    city: input.city,
    requireStreet: input.requireStreet,
  });
  let providerResult: { ok: true; taxCents: number; totalCents: number; reason: string } | { ok: false; detail: string } | null = null;
  if (input.phase === "calculate" && method === "automatic" && addressReady && input.subjectSelected) {
    const creds = await stripeCredentials();
    if (!creds.ok) {
      providerResult = { ok: false, detail: "The tax provider is not configured. Nothing was charged." };
    } else {
      providerResult = await requestStripeTaxCalculation({
        secret: creds.secret,
        amountCents: input.amountCents,
        currency: "usd",
        taxCode: input.taxCategory,
        country: input.country,
        region: input.region,
        postalCode: input.postalCode,
        inclusive: input.inclusive,
      });
    }
  }
  return decidePreview({
    audience: input.audience,
    phase: input.phase,
    method,
    addressReady,
    amountCents: input.amountCents,
    rateBps: input.rateBps,
    inclusive: input.inclusive,
    jurisdiction: input.jurisdiction,
    liableEntity: input.liableEntity,
    subjectSelected: input.subjectSelected,
    providerResult,
  });
}

export function accountsForSelection(accounts: { id: string; label: string; providerCode: string; environment: string }[], providerCode: string, environment: string) {
  return accountsFor(accounts, providerCode, environment);
}

export type { TaxDisplayStatus };
