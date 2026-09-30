import { actionUpdatePlanFeature } from "@/app/admin/plans/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { EDITABLE_FEATURE_KEYS, type PlanCode } from "@/lib/entitlements";
import { listPlanFeatures, type PlanFeatureEditorRow } from "@/lib/entitlements-db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plan entitlements · Admin" };

const LABELS: Record<string, { label: string; kind: "int" | "bool" | "text"; options?: string[] }> = {
  "card.social_links.max": { label: "Social links", kind: "int" },
  "card.specialties.max": { label: "Specialties", kind: "int" },
  "card.portfolio_items.max": { label: "Portfolio items", kind: "int" },
  "card.qr.enabled": { label: "QR code", kind: "bool" },
  "card.qr.dynamic": { label: "Dynamic QR", kind: "bool" },
  "card.shortlink.enabled": { label: "Shortlink", kind: "bool" },
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
};

const PLANS: PlanCode[] = ["STARTER", "PLUS", "PRO"];

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminPlansPage({ searchParams }: Props) {
  const session = await requireAdminPage("plans");
  const query = await searchParams;
  const canEdit = hasPermission(session, "plans.edit");
  const rows = await listPlanFeatures();
  const byKey = new Map<string, Map<PlanCode, PlanFeatureEditorRow>>();
  for (const row of rows) {
    const bucket = byKey.get(row.featureKey) ?? new Map();
    bucket.set(row.planCode, row);
    byKey.set(row.featureKey, bucket);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-indigo">Plan entitlements</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        These limits are the live card rules. Saving writes an audit record and the next page
        render uses the new value. Gold chrome follows the theme value <span className="font-semibold">full</span>.
      </p>
      {query.saved ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Saved. The public card will pick this up on the next request.
        </p>
      ) : null}
      {query.error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {query.error}
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-[#E4EBFF] bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-[#E4EBFF] text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Feature</th>
              {PLANS.map((plan) => (
                <th key={plan} className="px-4 py-3 font-semibold">
                  {plan.charAt(0) + plan.slice(1).toLowerCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EDITABLE_FEATURE_KEYS.map((key) => {
              const meta = LABELS[key];
              return (
                <tr key={key} className="border-b border-[#F0F3FA]">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-indigo">{meta.label}</div>
                    <div className="text-[11px] text-muted">{key}</div>
                  </td>
                  {PLANS.map((plan) => {
                    const row = byKey.get(key)?.get(plan);
                    return (
                      <td key={plan} className="px-4 py-3 align-top">
                        <form action={actionUpdatePlanFeature} className="flex items-center gap-2">
                          <input type="hidden" name="planCode" value={plan} />
                          <input type="hidden" name="featureKey" value={key} />
                          <input type="hidden" name="kind" value={meta.kind} />
                          {meta.kind === "int" ? (
                            <input
                              name="limitInt"
                              type="number"
                              min={0}
                              max={100}
                              defaultValue={row?.limitInt ?? 0}
                              disabled={!canEdit}
                              className="w-20 rounded-lg border border-[#E4EBFF] px-2 py-1"
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
    </div>
  );
}
