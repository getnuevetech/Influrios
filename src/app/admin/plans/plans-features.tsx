"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  actionCreatePlan,
  actionDeletePlan,
  actionUpdatePlanFeature,
  actionUpdatePlanMeta,
} from "@/app/admin/plans/actions";
import { AnnualPlanPrices } from "@/app/admin/plans/annual-plan-prices";
import { SubscriptionsDialog } from "@/app/admin/subscriptions/dialog";
import { IconPlus } from "@/components/icons";

const fieldClass = "mt-1 w-full rounded-xl border border-[#E4EBFF] px-3 py-2 text-sm font-normal text-indigo";

export type PlanFeatureEditor = {
  key: string;
  label: string;
  kind: "int" | "bool" | "text";
  hint?: string;
  options?: string[];
  limitInt: number | null;
  enabled: boolean;
  valueText: string;
  display: string;
};

export type PricedPlanRow = {
  code: string;
  name: string;
  description: string;
  audience: "creator" | "business";
  amountCents: number;
  monthlyDollars: string;
  annualDollars: string;
  annualStripePriceId: string;
  priceLabel: string;
  stripePriceId: string;
  publicListing: boolean;
  active: boolean;
  assigned: number;
  base: string;
  tax: string;
  total: string;
  annualBase: string;
  annualTax: string;
  annualTotal: string;
  note: string;
  awaitingRule: boolean;
  features: PlanFeatureEditor[];
};

export type PlanCopyOption = { code: string; name: string };

export function PlansFeatures({
  canEdit,
  audience,
  country,
  countries,
  chip,
  plans,
  copyFrom,
}: {
  canEdit: boolean;
  audience: "creator" | "business";
  country: string;
  countries: { code: string; name: string }[];
  chip: string | null;
  plans: PricedPlanRow[];
  copyFrom: PlanCopyOption[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const editingPlan = plans.find((plan) => plan.code === editing) ?? null;

  function visit(nextAudience: string, nextCountry: string) {
    const params = new URLSearchParams();
    params.set("audience", nextAudience);
    params.set("country", nextCountry);
    router.replace(`/admin/plans?${params.toString()}`);
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold text-indigo">Plans & features</h1>
        {canEdit ? (
          <button type="button" className="btn-primary !py-2 text-sm" onClick={() => setCreating(true)}>
            <IconPlus size={16} />
            Create plan
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 rounded-2xl border border-[#E4EBFF] bg-white p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm font-semibold text-indigo">
          Audience
          <select value={audience} onChange={(event) => visit(event.target.value, country)} className={fieldClass}>
            <option value="creator">Influencers</option>
            <option value="business">Businesses</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-indigo">
          Preview country
          <select value={country} onChange={(event) => visit(audience, event.target.value)} className={fieldClass}>
            {countries.length === 0 ? <option value="">No countries</option> : null}
            {countries.map((item) => (
              <option key={item.code} value={item.code}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="sm:pb-2">
          {chip ? (
            <span className="inline-flex rounded-full bg-[#EEE8FF] px-3 py-1.5 text-sm font-semibold text-violet">{chip}</span>
          ) : plans.some((plan) => plan.awaitingRule) ? (
            <span className="text-sm text-muted">No saved tax rule for this country</span>
          ) : null}
        </div>
      </div>

      <h2 className="mt-6 font-display text-lg font-bold text-indigo">Monthly pricing · USD</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-[#E4EBFF] bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="bg-[#F3EEFF] text-xs font-semibold text-indigo">
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Base price</th>
              <th className="px-4 py-3">Estimated tax</th>
              <th className="px-4 py-3">Estimated total</th>
              {canEdit ? <th className="px-4 py-3">Action</th> : null}
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 5 : 4} className="px-4 py-6 text-muted">
                  No plans for this audience.
                </td>
              </tr>
            ) : (
              plans.map((plan) => (
                <tr key={plan.code} className="border-t border-[#F0F3FA]">
                  <td className="px-4 py-3 font-semibold text-indigo">
                    {plan.name}
                    {plan.active ? null : <span className="ml-2 text-xs font-semibold text-muted">Hidden</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-indigo">{plan.base}</td>
                  <td className="px-4 py-3 tabular-nums text-indigo" title={plan.note || undefined}>
                    {plan.tax}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-indigo">{plan.total}</td>
                  {canEdit ? (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="rounded-full border border-violet px-4 py-1 text-sm font-semibold text-violet hover:bg-[#F6F3FF]"
                        onClick={() => setEditing(plan.code)}
                      >
                        Edit
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AnnualPlanPrices plans={plans} />

      <h2 className="mt-8 font-display text-lg font-bold text-indigo">Compare features</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl border border-[#E4EBFF] bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="bg-[#F3EEFF] text-xs font-semibold text-indigo">
              <th className="px-4 py-3">Feature</th>
              {plans.map((plan) => (
                <th key={plan.code} className="px-4 py-3">
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted">No plans to compare.</td>
              </tr>
            ) : (
              (plans[0]?.features ?? []).map((feature) => (
                <tr key={feature.key} className="border-t border-[#F0F3FA]">
                  <td className="px-4 py-3 font-semibold text-indigo">{feature.label}</td>
                  {plans.map((plan) => (
                    <td key={plan.code} className="px-4 py-3 text-indigo">
                      {plan.features.find((item) => item.key === feature.key)?.display ?? "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {creating ? (
        <SubscriptionsDialog title="Create plan" onClose={() => setCreating(false)} wide>
          <form action={actionCreatePlan} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="returnCountry" value={country} />
            <label className="text-sm font-semibold text-indigo">
              Code
              <input name="code" placeholder="STUDIO" className={fieldClass} />
            </label>
            <label className="text-sm font-semibold text-indigo">
              Name
              <input name="name" placeholder="Studio" className={fieldClass} />
            </label>
            <label className="text-sm font-semibold text-indigo">
              Audience
              <select name="audience" defaultValue={audience} className={fieldClass}>
                <option value="creator">Influencers</option>
                <option value="business">Businesses</option>
              </select>
            </label>
            <label className="text-sm font-semibold text-indigo">
              Copy features from
              <select name="copyFrom" className={fieldClass}>
                <option value="">Empty</option>
                {copyFrom.map((plan) => (
                  <option key={plan.code} value={plan.code}>
                    {plan.name} ({plan.code})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-indigo sm:col-span-2">
              Description
              <input name="description" className={fieldClass} />
            </label>
            <PlanPriceFields />
            <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-indigo">
              <input type="checkbox" name="publicListing" value="1" />
              Show on pricing
            </label>
            <button type="submit" className="btn-primary sm:col-span-2 !py-2 text-sm">
              Create plan
            </button>
          </form>
        </SubscriptionsDialog>
      ) : null}

      {editingPlan ? (
        <SubscriptionsDialog title={`Edit ${editingPlan.name}`} onClose={() => setEditing(null)} wide>
          <form action={actionUpdatePlanMeta} className="grid gap-3 sm:grid-cols-2">
            <ReturnFields audience={audience} country={country} />
            <input type="hidden" name="code" value={editingPlan.code} />
            {editingPlan.code === "STARTER" ? <input type="hidden" name="active" value="1" /> : null}
            <label className="text-sm font-semibold text-indigo">
              Name
              <input name="name" defaultValue={editingPlan.name} className={fieldClass} />
            </label>
            <label className="text-sm font-semibold text-indigo">
              Description
              <input name="description" defaultValue={editingPlan.description} className={fieldClass} />
            </label>
            <PlanPriceFields
              monthlyDollars={editingPlan.monthlyDollars}
              annualDollars={editingPlan.annualDollars}
              priceLabel={editingPlan.priceLabel}
              stripePriceId={editingPlan.stripePriceId}
              annualStripePriceId={editingPlan.annualStripePriceId}
            />
            <div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-indigo sm:col-span-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="publicListing" value="1" defaultChecked={editingPlan.publicListing} />
                Public
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="active"
                  value="1"
                  defaultChecked={editingPlan.active}
                  disabled={editingPlan.code === "STARTER"}
                />
                Active
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
              <button type="submit" className="btn-primary !py-2 text-sm">
                Save plan
              </button>
              {editingPlan.code !== "STARTER" ? (
                <button type="submit" formAction={actionDeletePlan} className="text-sm font-semibold text-rose-700">
                  Remove {editingPlan.code}
                  {editingPlan.assigned ? " (blocked while someone is on it)" : ""}
                </button>
              ) : null}
            </div>
          </form>
          <div className="mt-6 space-y-3 border-t border-[#F0F3FA] pt-4">
            <h3 className="font-display text-base font-bold text-indigo">Features</h3>
            {editingPlan.features.map((feature) => (
              <form key={feature.key} action={actionUpdatePlanFeature} className="flex flex-wrap items-end gap-2">
                <ReturnFields audience={audience} country={country} />
                <input type="hidden" name="planCode" value={editingPlan.code} />
                <input type="hidden" name="featureKey" value={feature.key} />
                <input type="hidden" name="kind" value={feature.kind} />
                <label className="min-w-40 flex-1 text-sm font-semibold text-indigo">
                  {feature.label}
                  {feature.kind === "int" ? (
                    <input name="limitInt" type="number" min={0} max={10000} defaultValue={feature.limitInt ?? 0} className={fieldClass} />
                  ) : null}
                  {feature.kind === "bool" ? (
                    <select name="enabled" defaultValue={feature.enabled ? "true" : "false"} className={fieldClass}>
                      <option value="true">On</option>
                      <option value="false">Off</option>
                    </select>
                  ) : null}
                  {feature.kind === "text" ? (
                    <select name="valueText" defaultValue={feature.valueText} className={fieldClass}>
                      {feature.options?.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {feature.hint ? <span className="mt-1 block text-xs font-normal text-muted">{feature.hint}</span> : null}
                </label>
                <button type="submit" className="mb-1 text-sm font-semibold text-violet hover:underline">
                  Save
                </button>
              </form>
            ))}
          </div>
        </SubscriptionsDialog>
      ) : null}
    </>
  );
}

function PlanPriceFields({
  monthlyDollars = "0.00",
  annualDollars = "",
  priceLabel = "",
  stripePriceId = "",
  annualStripePriceId = "",
}: {
  monthlyDollars?: string;
  annualDollars?: string;
  priceLabel?: string;
  stripePriceId?: string;
  annualStripePriceId?: string;
}) {
  return (
    <>
      <p className="text-sm font-normal text-muted sm:col-span-2">
        Enter dollars. A stored value of 2500 cents opens here as 25.00. An annual amount can be saved before the annual Stripe price id. Public pricing can show that amount, and checkout stays unpublished until the annual Stripe price id is saved. Leave both blank to keep annual unpublished. The annual Stripe price id has to differ from the monthly Stripe price id. Existing subscribers stay on the price they already use.
      </p>
      <label className="text-sm font-semibold text-indigo">
        Monthly price (USD)
        <input name="monthlyPrice" inputMode="decimal" defaultValue={monthlyDollars} placeholder="0.00" autoComplete="off" className={fieldClass} />
      </label>
      <label className="text-sm font-semibold text-indigo">
        Annual price (USD)
        <input name="annualPrice" inputMode="decimal" defaultValue={annualDollars} placeholder="Leave blank to keep annual unpublished" autoComplete="off" className={fieldClass} />
      </label>
      <label className="text-sm font-semibold text-indigo">
        Price label
        <input name="priceLabel" defaultValue={priceLabel} placeholder="$49/mo" className={fieldClass} />
        <span className="mt-1 block text-xs font-normal text-muted">Admin label only. Checkout uses the dollar amounts.</span>
      </label>
      <label className="text-sm font-semibold text-indigo">
        Stripe price id
        <input name="stripePriceId" defaultValue={stripePriceId} placeholder="price_..." className={fieldClass} />
      </label>
      <label className="text-sm font-semibold text-indigo sm:col-span-2">
        Annual Stripe price id
        <input name="annualStripePriceId" defaultValue={annualStripePriceId} placeholder="price_..." className={fieldClass} />
      </label>
    </>
  );
}

function ReturnFields({ audience, country }: { audience: string; country: string }) {
  return (
    <>
      <input type="hidden" name="returnAudience" value={audience} />
      <input type="hidden" name="returnCountry" value={country} />
    </>
  );
}
