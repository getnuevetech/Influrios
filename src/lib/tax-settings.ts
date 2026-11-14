/**
 * Loads tax settings and runs a preview. A preview does not open a charge.
 */
import { State } from "country-state-city";
import { getProduct } from "@/lib/billing";
import { corridorCountries } from "@/lib/corridor-countries";
import { prisma } from "@/lib/db";
import {
  INFLUENCER_SERVICE_SUBJECTS,
  accountsFor,
  billingAddressReady,
  decidePreview,
  eligiblePaymentIntegrations,
  feeRuleChoiceLabel,
  planTaxGate,
  registrationLabel,
  storedRateToPercent,
  subscriptionGaps,
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

function asMethod(value: string): "" | "automatic" | "manual" {
  return value === "automatic" || value === "manual" ? value : "";
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
    feeRules: rules
      .filter((rule) => rule.purpose === "business_platform_fee" || rule.purpose === "influencer_platform_fee")
      .map((rule) => ({
        id: rule.id,
        label: feeRuleChoiceLabel(rule.name, rule.purpose === "business_platform_fee" ? "business_fee" : "influencer_fee"),
        purpose: rule.purpose === "business_platform_fee" ? "business_fee" as const : "influencer_fee" as const,
      })),
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

export async function subscriptionTaxGates(plans: { code: string; sku: string; amountCents: number; checkout: boolean }[]) {
  const catalog = await loadTaxCatalog().catch(() => null);
  const policies = (catalog?.records ?? []).map((policy) => ({
    id: policy.id,
    appliesTo: policy.appliesTo,
    status: policy.status,
    linkedIds: policy.linkedIds,
    countryCode: policy.countryCode,
    regionCode: policy.regionCode,
    providerCode: policy.providerCode,
    providerAccountId: policy.providerAccountId,
    calculationMethod: policy.calculationMethod,
    taxCategory: policy.taxCategory,
    liableEntity: policy.liableEntity,
    rateBps: policy.rateBps,
    jurisdiction: policy.jurisdiction,
    hasEffectiveFrom: policy.hasEffectiveFrom,
  }));
  const saved = catalog?.rawPlans ?? [];
  const gates: Record<string, ReturnType<typeof planTaxGate>> = {};
  for (const plan of plans) {
    const product = getProduct(plan.sku);
    const code = product?.creatorPlan || product?.businessPlan || plan.code;
    const row = saved.find((item) => item.code === code || item.code === plan.code || item.id === plan.code);
    const gaps = plan.amountCents <= 0 || !plan.checkout
      ? []
      : subscriptionGaps({
          planKeys: [plan.code, plan.sku, code, row?.id ?? ""].filter(Boolean),
          taxPolicyId: row?.taxPolicyId,
          policies,
        });
    gates[plan.code] = planTaxGate({ amountCents: plan.amountCents, checkout: plan.checkout, gaps });
  }
  return gates;
}

export async function subscriptionCheckoutContext(sku: string) {
  const product = getProduct(sku);
  const code = product?.creatorPlan || product?.businessPlan || sku;
  const plan = await prisma.entitlementPlan.findFirst({
    where: { OR: [{ code: sku }, { id: sku }, { code }] },
    select: { id: true, code: true, name: true, amountCents: true, taxPolicyId: true },
  }).catch(() => null);
  const amountCents = plan?.amountCents ?? product?.amountCents ?? 0;
  const checkout = amountCents > 0;
  const gates = await subscriptionTaxGates([{ code: plan?.code ?? code, sku, amountCents, checkout }]);
  const gate = gates[plan?.code ?? code] ?? planTaxGate({ amountCents, checkout, gaps: checkout ? ["Tax configuration for this plan"] : [] });
  const catalog = await loadTaxCatalog().catch(() => null);
  const policy = catalog?.records.find((row) => row.id === plan?.taxPolicyId && (row.status === "ready" || row.status === "active") && row.appliesTo === "subscription") ?? null;
  return { gate, plan, amountCents, policy };
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
  const addressReady = billingAddressReady({
    country: input.country,
    region: input.region,
    postalCode: input.postalCode,
    line1: input.line1,
    city: input.city,
    requireStreet: input.requireStreet,
  });
  let providerResult: { ok: true; taxCents: number; totalCents: number; reason: string } | { ok: false; detail: string } | null = null;
  if (input.phase === "calculate" && input.method === "automatic" && addressReady && input.subjectSelected && input.liableEntity) {
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
    method: input.method,
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
