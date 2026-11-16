import { PlansFeatures, type PlanFeatureEditor, type PricedPlanRow } from "@/app/admin/plans/plans-features";
import { SubscriptionsShell } from "@/app/admin/subscriptions/shell";
import { requireAdminPage } from "@/app/admin/guard";
import { canAccessModule, hasPermission } from "@/lib/admin-auth";
import { estimatePlanPrice, formatPlanMoney, intervalTaxLine, presentPlanPrice, previewRateChip } from "@/lib/admin-subscription-view";
import { listAnnualOffers } from "@/lib/billing";
import { annualOfferKey, planPriceFieldsFromStored } from "@/lib/billing-interval";
import { BUSINESS_FEATURE_KEYS } from "@/lib/business-entitlements";
import { dedupeCountryRules, flagRuleConflicts, mapStoredPolicy } from "@/lib/country-tax";
import { EDITABLE_FEATURE_KEYS } from "@/lib/entitlements";
import { listPlanCatalog, listPlanFeatures, type PlanCatalogRow, type PlanFeatureEditorRow } from "@/lib/entitlements-db";
import { PLAN_FEATURE_META, presentFeature } from "@/lib/plan-presentation";
import { loadTaxCatalog, planMatchKeys } from "@/lib/tax-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plans & features · Admin" };

type Props = { searchParams: Promise<{ saved?: string; error?: string; audience?: string; country?: string }> };

export default async function AdminPlansPage({ searchParams }: Props) {
  const session = await requireAdminPage("plans");
  const query = await searchParams;
  const canEdit = hasPermission(session, "plans.edit");
  const showBilling = canAccessModule(session, "billing");
  let rows: PlanFeatureEditorRow[] = [];
  let plans: PlanCatalogRow[] = [];
  let dbError = false;
  const catalog = await loadTaxCatalog().catch(() => null);
  const rules = flagRuleConflicts(
    dedupeCountryRules((catalog?.records ?? []).map((record) => mapStoredPolicy(record)).filter((rule) => rule != null)),
  );
  const countries = catalog?.countries ?? [];
  const keysByCode = new Map((catalog?.plans ?? []).map((plan) => [plan.code, planMatchKeys(plan)]));
  let annual: Awaited<ReturnType<typeof listAnnualOffers>> = {};
  try {
    [rows, plans, annual] = await Promise.all([listPlanFeatures(), listPlanCatalog(), listAnnualOffers()]);
  } catch (error) {
    console.error("admin plans", error);
    dbError = true;
  }

  const audience = query.audience === "business" || query.audience === "creator"
    ? query.audience
    : plans.some((plan) => plan.audience === "creator")
      ? "creator"
      : "business";
  const requested = (query.country ?? "").trim().toUpperCase();
  const country = countries.some((item) => item.code === requested)
    ? requested
    : countries.some((item) => item.code === "US")
      ? "US"
      : countries[0]?.code ?? "";
  const visible = plans.filter((plan) => plan.audience === audience);
  const keys = audience === "business" ? BUSINESS_FEATURE_KEYS : EDITABLE_FEATURE_KEYS;
  const estimates = visible.map((plan) =>
    estimatePlanPrice({
      amountCents: plan.amountCents,
      countryCode: country,
      keys: keysByCode.get(plan.code) ?? [plan.code],
      rules,
    }),
  );
  const priced: PricedPlanRow[] = visible.map((plan, index) => {
    const estimate = estimates[index]!;
    const price = presentPlanPrice(estimate);
    const taxKeys = keysByCode.get(plan.code) ?? [plan.code];
    const monthlyLine = intervalTaxLine({
      amountCents: plan.amountCents,
      countryCode: country,
      keys: taxKeys,
      rules,
    });
    const shownMonthly = monthlyLine.taxLineCount === 1 && monthlyLine.taxCents != null && monthlyLine.totalCents != null
      ? {
          base: formatPlanMoney(monthlyLine.baseCents),
          tax: formatPlanMoney(monthlyLine.taxCents),
          total: formatPlanMoney(monthlyLine.totalCents),
        }
      : { base: price.base, tax: price.tax, total: price.total };
    const offer = annual[annualOfferKey(plan.code)] ?? null;
    const dollars = planPriceFieldsFromStored({
      amountCents: plan.amountCents,
      annual: offer ? { amountCents: offer.amountCents, priceId: offer.priceId } : null,
    });
    const annualCents = offer && offer.amountCents > 0 ? offer.amountCents : null;
    const annualLine = annualCents == null
      ? null
      : intervalTaxLine({ amountCents: annualCents, countryCode: country, keys: taxKeys, rules });
    return {
      code: plan.code,
      name: plan.name,
      description: plan.description,
      audience: plan.audience,
      amountCents: plan.amountCents,
      monthlyDollars: dollars.monthlyDollars,
      annualDollars: dollars.annualDollars,
      annualStripePriceId: dollars.annualPriceId,
      priceLabel: plan.priceLabel,
      stripePriceId: plan.stripePriceId,
      publicListing: plan.publicListing,
      active: plan.active,
      assigned: plan.assigned,
      base: shownMonthly.base,
      tax: shownMonthly.tax,
      total: shownMonthly.total,
      annualBase: annualLine ? formatPlanMoney(annualLine.baseCents) : "",
      annualTax: annualLine?.taxLineCount === 1 && annualLine.taxCents != null ? formatPlanMoney(annualLine.taxCents) : "",
      annualTotal: annualLine?.taxLineCount === 1 && annualLine.totalCents != null ? formatPlanMoney(annualLine.totalCents) : "",
      note: price.note,
      awaitingRule: estimate.method === "missing",
      features: featureEditors(plan.code, keys, rows),
    };
  });
  const chip = previewRateChip(estimates);

  return (
    <SubscriptionsShell active="plans" showPlans showBilling={showBilling}>
      {query.saved ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Saved.</p>
      ) : null}
      {query.error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{query.error}</p>
      ) : null}
      {dbError ? <p className="mt-4 text-sm text-amber-800">Plans are unavailable.</p> : null}
      <PlansFeatures
        canEdit={canEdit}
        audience={audience}
        country={country}
        countries={countries}
        chip={chip}
        plans={priced}
        copyFrom={plans.map((plan) => ({ code: plan.code, name: plan.name }))}
      />
    </SubscriptionsShell>
  );
}

function featureEditors(planCode: string, keys: readonly string[], rows: PlanFeatureEditorRow[]): PlanFeatureEditor[] {
  const editors: PlanFeatureEditor[] = [];
  for (const key of keys) {
    const meta = PLAN_FEATURE_META[key];
    if (!meta) continue;
    const row = rows.find((item) => item.planCode === planCode && item.featureKey === key);
    const value = row ?? { featureKey: key, enabled: false, limitInt: null, valueText: null };
    const presented = presentFeature(key, value);
    editors.push({
      key,
      label: meta.label,
      kind: meta.kind,
      hint: meta.hint,
      options: meta.options,
      limitInt: row?.limitInt ?? 0,
      enabled: Boolean(row?.enabled),
      valueText: row?.valueText ?? meta.options?.[0] ?? "",
      display: presented.included ? presented.text : "—",
    });
  }
  return editors;
}
