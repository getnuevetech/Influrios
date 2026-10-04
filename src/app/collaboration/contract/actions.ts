"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { getBusinessEntitlements } from "@/lib/business-entitlements";
import { getWorkspace } from "@/lib/business";
import { asServiceLevel, resolveFee } from "@/lib/collaboration-fees";
import {
  buildFinancialPlan,
  canFundContract,
  countryCodeFromLocation,
  customMilestonesGate,
  evaluatePreContractGates,
  lockFinancialPlan,
  parseMilestoneDraftsFromForm,
  type MilestoneDraft,
} from "@/lib/contract-wizard";
import { prisma } from "@/lib/db";
import { getDirectoryCreator } from "@/lib/directory";
import {
  capabilitiesFromJurisdictionRow,
  serviceLevelAllowedByJurisdiction,
} from "@/lib/jurisdiction-capabilities";
import { hasCurrentLegalRecord } from "@/lib/legal";
import { ensureMarketplaceDefaults, marketplaceConfig, requestPrefund } from "@/lib/marketplace-ledger";
import { computePayoutReadiness } from "@/lib/payout-readiness";
import { paymentRoutes } from "@/lib/providers";

const BASE = "/collaboration/contract";

function dollarsToCents(raw: string) {
  const amount = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

function redirectError(message: string, qs: URLSearchParams): never {
  qs.set("error", message);
  redirect(`${BASE}?${qs.toString()}`);
}

function readDrafts(formData: FormData, usingCustom: boolean, templates: MilestoneDraft[]): MilestoneDraft[] {
  if (!usingCustom) return templates;
  const titles = formData.getAll("milestoneTitle").map((v) => String(v));
  const percents = formData.getAll("milestonePercent").map((v) => String(v));
  return parseMilestoneDraftsFromForm({ titles, percents });
}

export async function actionSubmitContractWizard(formData: FormData) {
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect(`/login?next=${encodeURIComponent(BASE)}&gate=business`);

  const termsOk = await hasCurrentLegalRecord({
    documentKey: "business-terms",
    userId: account.id,
  }).catch(() => false);
  if (!termsOk) {
    redirect(`/collaboration/business?error=${encodeURIComponent("Agree to the Business / Brand Terms before starting a contract.")}`);
  }

  const ws = await getWorkspace();
  const entitlements = getBusinessEntitlements(ws.plan);
  const creatorSlug = String(formData.get("creatorSlug") ?? "").trim();
  const businessName = String(formData.get("businessName") ?? ws.name).trim() || ws.name;
  const title = String(formData.get("title") ?? "").trim();
  const scope = String(formData.get("scope") ?? "").trim();
  const commercial = String(formData.get("commercial") ?? "").trim();
  const jurisdictionCode = String(formData.get("jurisdictionCode") ?? "US").trim().toUpperCase() || "US";
  const serviceLevelRaw = asServiceLevel(String(formData.get("serviceLevel") ?? "contracted"));
  const serviceLevel = serviceLevelRaw === "*" ? "contracted" : serviceLevelRaw;
  const grossCents = dollarsToCents(String(formData.get("grossUsd") ?? ""));
  const usingCustom = formData.get("milestoneMode") === "custom";
  const influencerAccepted = formData.get("influencerAccepted") === "on";
  const partyAccepted = formData.get("partyAccepted") === "on";
  const intent = String(formData.get("intent") ?? "preview");

  const qs = new URLSearchParams();
  qs.set("creator", creatorSlug);
  qs.set("title", title);
  qs.set("scope", scope);
  qs.set("commercial", commercial);
  qs.set("jurisdiction", jurisdictionCode);
  qs.set("serviceLevel", serviceLevel);
  qs.set("gross", String(formData.get("grossUsd") ?? ""));
  qs.set("mode", usingCustom ? "custom" : "template");
  if (influencerAccepted) qs.set("influencerAccepted", "1");
  if (partyAccepted) qs.set("accepted", "1");

  if (!creatorSlug || !title || !scope || grossCents <= 0) {
    redirectError("Add the influencer, title, scope, and a gross amount.", qs);
  }

  const creator = await getDirectoryCreator(creatorSlug);
  if (!creator) redirectError("That influencer was not found in the directory.", qs);

  await ensureMarketplaceDefaults();
  const config = await marketplaceConfig();
  const templates: MilestoneDraft[] = (config.templates ?? [])
    .filter((row) => row.active)
    .map((row) => ({ title: row.title, shareBps: row.shareBps }));

  const drafts = readDrafts(formData, usingCustom, templates);
  const milestoneGate = customMilestonesGate({
    entitled: entitlements.customMilestones,
    usingCustom,
    milestones: drafts,
    influencerAccepted,
  });
  if (!milestoneGate.ok) redirectError(milestoneGate.error, qs);

  const creatorCountry =
    countryCodeFromLocation(creator.locationCountry) ??
    (jurisdictionCode.length === 2 ? jurisdictionCode : null);
  const routes = await paymentRoutes().catch(() => []);
  const route = creatorCountry
    ? routes.find((row) => row.countryCode === creatorCountry)
    : undefined;

  const dbCreator = await prisma.creator.findUnique({ where: { slug: creatorSlug } }).catch(() => null);
  const identityVerified = dbCreator?.identityVerified === "VERIFIED";
  const payoutReadiness = dbCreator
    ? await computePayoutReadiness({
        creatorId: dbCreator.id,
        identityVerified,
        locationCountry: dbCreator.locationCountry ?? creator.locationCountry,
      }).catch(() => null)
    : null;

  const jurisdiction = config.jurisdictions.find((row) => row.code === jurisdictionCode);
  const provider =
    config.providers.find((row) => row.code === (jurisdiction?.providerCode || "primary")) ?? config.provider;

  const caps = jurisdiction ? capabilitiesFromJurisdictionRow(jurisdiction) : null;
  if (caps) {
    const serviceGate = serviceLevelAllowedByJurisdiction(caps, serviceLevel);
    if (!serviceGate.ok) redirectError(serviceGate.error, qs);
  }

  const gates = evaluatePreContractGates({
    businessName,
    creatorSlug,
    identityVerified,
    creatorCountryKnown: Boolean(creatorCountry),
    corridorActive: payoutReadiness ? payoutReadiness.corridorActive : Boolean(creatorCountry),
    paymentRouteReady: Boolean(route?.ready),
    jurisdictionProtectedPayments: Boolean(jurisdiction?.protectedPaymentsEnabled),
    marketplaceProviderReady: Boolean(provider?.ready),
  });

  qs.set("step", intent === "fund" ? "funding" : intent === "accept" ? "accept" : "preview");

  if (intent === "preview" || intent === "accept") {
    if (!gates.ok && intent === "accept") {
      qs.set("step", "payment_readiness");
      redirectError(gates.blockers[0] ?? "Payment readiness is incomplete.", qs);
    }
    qs.set("step", intent === "accept" ? "accept" : "preview");
    redirect(`${BASE}?${qs.toString()}`);
  }

  const fundGate = canFundContract({
    gates,
    milestones: milestoneGate,
    accepted: partyAccepted,
  });
  if (!fundGate.ok) {
    qs.set("step", gates.ok ? "accept" : "payment_readiness");
    redirectError(fundGate.error, qs);
  }

  const quote = await resolveFee({
    jurisdiction: jurisdictionCode,
    serviceLevel,
    grossValueCents: grossCents,
  }).catch(() => null);

  const plan = buildFinancialPlan({
    grossCents,
    currency: jurisdiction?.currency ?? "USD",
    feeRuleId: quote?.rule?.id ?? null,
    feeRuleVersion: quote?.rule?.version ?? null,
    feeMethod: quote?.rule?.method ?? null,
    feePercentBps: quote?.rule?.percentBps ?? null,
    feeFixedCents: quote?.rule?.fixedCents ?? null,
    totalPlatformFeeCents: quote?.feeCents ?? 0,
    feePayer: quote?.rule?.payer ?? "brand",
    fundingCountry: jurisdictionCode,
    creatorCountry: creatorCountry ?? jurisdictionCode,
    payoutCurrency: jurisdiction?.currency ?? "USD",
    milestones: drafts,
    milestoneSource: usingCustom ? "custom" : "template",
  });
  if (!plan) redirectError("Could not build a financial plan for those milestones.", qs);

  const locked = lockFinancialPlan(plan);
  const result = await requestPrefund({
    businessName,
    creatorSlug,
    title: `${title} · ${scope.slice(0, 40)}`,
    jurisdictionCode,
    grossCents,
    serviceLevel,
    customMilestones: usingCustom ? drafts : null,
    financialPlan: locked as unknown as Record<string, unknown>,
  });
  if (!result.ok) {
    qs.set("step", "funding");
    redirectError(result.error, qs);
  }

  revalidatePath(BASE);
  revalidatePath("/payments");
  revalidatePath("/collaboration/business");
  redirect(`/payments?created=${result.id}`);
}
