import {
  actionCreatePlan,
  actionDeletePlan,
  actionUpdatePlanFeature,
  actionUpdatePlanMeta,
} from "@/app/admin/plans/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { BUSINESS_FEATURE_KEYS } from "@/lib/business-entitlements";
import { EDITABLE_FEATURE_KEYS } from "@/lib/entitlements";
import { listPlanCatalog, listPlanFeatures, type PlanFeatureEditorRow } from "@/lib/entitlements-db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plan entitlements · Admin" };

const LABELS: Record<string, { label: string; kind: "int" | "bool" | "text"; options?: string[]; hint?: string }> = {
  "card.social_links.max": { label: "Social links", kind: "int" },
  "card.specialties.max": { label: "Specialties", kind: "int" },
  "card.portfolio_items.max": { label: "Portfolio items", kind: "int" },
  "card.qr.enabled": { label: "QR code", kind: "bool" },
  "card.qr.dynamic": { label: "Dynamic destination", kind: "bool" },
  "card.nfc.enabled": {
    label: "NFC tag URL",
    kind: "bool",
    hint: "Mints inflr.me/n/{token}. The creator writes that URL onto a physical tag.",
  },
  "card.shortlink.enabled": { label: "Short link", kind: "bool" },
  "card.shortlink.max": { label: "Profile short links", kind: "int", hint: "The inflr.me/{name} link. This is not the campaign-link count." },
  "card.campaign_links.max": {
    label: "Campaign links",
    kind: "int",
    hint: "The number you save is the only campaign-link limit for this plan. A new plan starts at 0. Nothing else adds a count.",
  },
  "card.custom_slug.enabled": { label: "Custom slug", kind: "bool" },
  "card.collaboration.enabled": { label: "Collaboration CTA", kind: "bool" },
  "collaboration.proposals.max": { label: "Proposals per window", kind: "int" },
  "card.media_kit.enabled": { label: "Media kit", kind: "bool" },
  "card.lead_tracking.enabled": { label: "Lead tracking", kind: "bool" },
  "card.contact.level": { label: "Contact", kind: "text", options: ["none", "limited", "full"] },
  "card.analytics.level": { label: "Analytics", kind: "text", options: ["views", "standard", "advanced"] },
  "card.custom_theme.level": { label: "Theme", kind: "text", options: ["default", "limited", "full"] },
  "card.platform_branding": {
    label: "Platform branding",
    kind: "text",
    options: ["visible", "reduced", "minimal"],
  },
  "business.shortlist.max": { label: "Shortlist size", kind: "int" },
  "business.inquiry.max": { label: "Inquiries per month", kind: "int" },
  "business.team_seats.max": { label: "Team seats", kind: "int" },
  "business.advanced_filters": { label: "Advanced filters", kind: "bool" },
  "business.fit_insights": { label: "Fit insights", kind: "bool" },
  "business.exports": { label: "Exports", kind: "bool" },
  "business.saved_alerts": { label: "Saved alerts", kind: "bool" },
  "business.managed_matching": { label: "Managed matching", kind: "bool" },
  "business.intelligence": { label: "Intelligence", kind: "bool" },
  "business.agency_workspace": { label: "Agency workspace", kind: "bool" },
  "business.custom_milestones": { label: "Custom milestones", kind: "bool" },
};

const inputClass = "mt-1 w-full rounded-lg border border-[#E4EBFF] px-2 py-1 text-sm font-normal";

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminPlansPage({ searchParams }: Props) {
  const session = await requireAdminPage("plans");
  const query = await searchParams;
  const canEdit = hasPermission(session, "plans.edit");
  let rows: PlanFeatureEditorRow[] = [];
  let plans: Awaited<ReturnType<typeof listPlanCatalog>> = [];
  let dbError = false;
  try {
    [rows, plans] = await Promise.all([listPlanFeatures(), listPlanCatalog()]);
  } catch (error) {
    console.error("admin plans", error);
    dbError = true;
  }
  const creatorPlans = plans.filter((plan) => plan.audience === "creator");
  const businessPlans = plans.filter((plan) => plan.audience === "business");

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-display text-2xl font-bold text-indigo">Plans</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Each plan is a code plus a set of features. Change a number, turn a feature on or off, add a plan, or remove a
        plan that nobody is using and create that code again. Campaign links are their own count of inflr.me/c/{"{code}"}{" "}
        addresses. They are not leftover short-link slots. NFC is its own switch: it mints inflr.me/n/{"{token}"}, and
        the creator writes that URL onto a physical tag. The FAQ explains how.
      </p>
      {query.saved ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Saved.</p>
      ) : null}
      {query.error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{query.error}</p>
      ) : null}
      {dbError ? <p className="mt-4 text-sm text-amber-800">Plans are unavailable.</p> : null}

      {canEdit ? (
        <form action={actionCreatePlan} className="card-surface mt-6 grid gap-3 p-5 sm:grid-cols-2">
          <h2 className="font-display text-lg font-bold text-indigo sm:col-span-2">New plan</h2>
          <label className="text-sm font-semibold text-indigo">
            Code
            <input name="code" placeholder="STUDIO" className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-indigo">
            Name
            <input name="name" placeholder="Studio" className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-indigo">
            Audience
            <select name="audience" className={inputClass}>
              <option value="creator">Creator</option>
              <option value="business">Business</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-indigo">
            Copy features from
            <select name="copyFrom" className={inputClass}>
              <option value="">Empty</option>
              {plans.map((plan) => (
                <option key={plan.code} value={plan.code}>
                  {plan.name} ({plan.code})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-indigo sm:col-span-2">
            Description
            <input name="description" className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-indigo">
            Monthly price (cents)
            <input name="amountCents" type="number" min={0} defaultValue={0} className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-indigo">
            Price label
            <input name="priceLabel" placeholder="$49/mo" className={inputClass} />
          </label>
          <label className="text-sm font-semibold text-indigo">
            Stripe price id
            <input name="stripePriceId" placeholder="price_..." className={inputClass} />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-indigo">
            <input type="checkbox" name="publicListing" value="1" />
            Show on pricing
          </label>
          <button type="submit" className="btn-primary sm:col-span-2 !py-2 text-sm">
            Create plan
          </button>
        </form>
      ) : null}

      <div className="mt-6 space-y-4">
        {plans.map((plan) => (
          <form key={plan.code} action={actionUpdatePlanMeta} className="card-surface grid gap-3 p-5 sm:grid-cols-4">
            <div className="sm:col-span-4">
              <p className="font-display text-lg font-bold text-indigo">
                {plan.name} <span className="text-sm font-semibold text-muted">{plan.code}</span>
              </p>
              <p className="text-xs text-muted">
                {plan.audience} · {plan.assigned} assigned · {plan.active ? "active" : "hidden from new assignment"}
              </p>
            </div>
            <input type="hidden" name="code" value={plan.code} />
            {plan.code === "STARTER" ? <input type="hidden" name="active" value="1" /> : null}
            <label className="text-xs font-semibold text-indigo">
              Name
              <input name="name" defaultValue={plan.name} disabled={!canEdit} className={inputClass} />
            </label>
            <label className="text-xs font-semibold text-indigo sm:col-span-3">
              Description
              <input name="description" defaultValue={plan.description} disabled={!canEdit} className={inputClass} />
            </label>
            <label className="text-xs font-semibold text-indigo">
              Cents
              <input name="amountCents" type="number" min={0} defaultValue={plan.amountCents} disabled={!canEdit} className={inputClass} />
            </label>
            <label className="text-xs font-semibold text-indigo">
              Price label
              <input name="priceLabel" defaultValue={plan.priceLabel} disabled={!canEdit} className={inputClass} />
            </label>
            <label className="text-xs font-semibold text-indigo">
              Stripe price id
              <input name="stripePriceId" defaultValue={plan.stripePriceId} disabled={!canEdit} className={inputClass} />
            </label>
            <div className="flex flex-wrap items-end gap-3 pb-1 text-sm font-semibold text-indigo">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="publicListing" value="1" defaultChecked={plan.publicListing} disabled={!canEdit} />
                Public
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="active" value="1" defaultChecked={plan.active} disabled={!canEdit || plan.code === "STARTER"} />
                Active
              </label>
              {canEdit ? (
                <button type="submit" className="text-xs font-bold text-violet hover:underline">
                  Save plan
                </button>
              ) : null}
            </div>
            {canEdit && plan.code !== "STARTER" ? (
              <div className="sm:col-span-4">
                <button formAction={actionDeletePlan} className="text-xs font-bold text-rose-700 hover:underline">
                  Remove {plan.code}
                  {plan.assigned ? " (blocked while someone is on it)" : ""}
                </button>
              </div>
            ) : null}
          </form>
        ))}
      </div>

      <FeatureMatrix title="Creator features" keys={EDITABLE_FEATURE_KEYS} plans={creatorPlans} rows={rows} canEdit={canEdit} />
      <FeatureMatrix title="Business features" keys={BUSINESS_FEATURE_KEYS} plans={businessPlans} rows={rows} canEdit={canEdit} />
    </div>
  );
}

function FeatureMatrix({
  title,
  keys,
  plans,
  rows,
  canEdit,
}: {
  title: string;
  keys: readonly string[];
  plans: Awaited<ReturnType<typeof listPlanCatalog>>;
  rows: PlanFeatureEditorRow[];
  canEdit: boolean;
}) {
  const byKey = new Map<string, Map<string, PlanFeatureEditorRow>>();
  for (const row of rows) {
    const bucket = byKey.get(row.featureKey) ?? new Map();
    bucket.set(row.planCode, row);
    byKey.set(row.featureKey, bucket);
  }
  if (!plans.length) return null;
  return (
    <section className="mt-8">
      <h2 className="font-display text-lg font-bold text-indigo">{title}</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-[#E4EBFF] bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-[#E4EBFF] text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Feature</th>
              {plans.map((plan) => (
                <th key={plan.code} className="px-4 py-3 font-semibold">
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => {
              const meta = LABELS[key];
              if (!meta) return null;
              return (
                <tr key={key} className="border-b border-[#F0F3FA]">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-indigo">{meta.label}</div>
                    <div className="text-[11px] text-muted">{key}</div>
                    {meta.hint ? <div className="mt-1 max-w-xs text-[11px] text-muted">{meta.hint}</div> : null}
                  </td>
                  {plans.map((plan) => {
                    const row = byKey.get(key)?.get(plan.code);
                    return (
                      <td key={plan.code} className="px-4 py-3 align-top">
                        <form action={actionUpdatePlanFeature} className="flex items-center gap-2">
                          <input type="hidden" name="planCode" value={plan.code} />
                          <input type="hidden" name="featureKey" value={key} />
                          <input type="hidden" name="kind" value={meta.kind} />
                          {meta.kind === "int" ? (
                            <input
                              name="limitInt"
                              type="number"
                              min={0}
                              max={10000}
                              defaultValue={row?.limitInt ?? 0}
                              disabled={!canEdit}
                              className="w-24 rounded-lg border border-[#E4EBFF] px-2 py-1"
                            />
                          ) : null}
                          {meta.kind === "bool" ? (
                            <select
                              name="enabled"
                              defaultValue={row?.enabled ? "true" : "false"}
                              disabled={!canEdit}
                              className="rounded-lg border border-[#E4EBFF] px-2 py-1"
                            >
                              <option value="true">On</option>
                              <option value="false">Off</option>
                            </select>
                          ) : null}
                          {meta.kind === "text" ? (
                            <select
                              name="valueText"
                              defaultValue={row?.valueText ?? meta.options?.[0]}
                              disabled={!canEdit}
                              className="rounded-lg border border-[#E4EBFF] px-2 py-1"
                            >
                              {meta.options?.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          {canEdit ? (
                            <button type="submit" className="text-xs font-bold text-violet hover:underline">
                              Save
                            </button>
                          ) : null}
                        </form>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
