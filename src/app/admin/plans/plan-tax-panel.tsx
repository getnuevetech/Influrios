import Link from "next/link";
import type { PlanTaxGate } from "@/lib/tax-configuration";
import { subscriptionTaxGates } from "@/lib/tax-settings";
import { prisma } from "@/lib/db";

export async function PlanTaxPanel({ canEdit }: { canEdit: boolean }) {
  const plans = await prisma.entitlementPlan.findMany({
    orderBy: { sortOrder: "asc" },
    select: { code: true, name: true, amountCents: true },
  }).catch(() => []);
  const gates = await subscriptionTaxGates(plans.map((plan) => ({
    code: plan.code,
    sku: plan.code,
    amountCents: plan.amountCents,
    checkout: plan.amountCents > 0,
  }))).catch(() => ({} as Record<string, PlanTaxGate>));
  return (
    <section data-screen="S01" className="space-y-3">
      <h2 className="font-display text-2xl font-bold text-indigo">Tax</h2>
      <p className="text-sm text-muted">
        Each plan has its own tax setup. A missing setting on one plan does not block the others, and a free plan stays available.
        {canEdit ? " Edit the setup in Tax Settings." : ""}
      </p>
      <ul className="space-y-2 text-sm">
        {plans.map((plan) => {
          const gate = gates[plan.code];
          const label = plan.amountCents <= 0 ? "No charge" : gate?.kind === "checkout" ? "Tax calculated at checkout" : gate?.kind === "unavailable" ? `Temporarily unavailable · ${gate.missing}` : "Not configured";
          return (
            <li key={plan.code} className="flex items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3">
              <span className="font-semibold">{plan.name}</span>
              <span className="text-muted">{label}</span>
            </li>
          );
        })}
      </ul>
      {canEdit ? <Link href="/admin/payment-settings?section=tax" className="inline-block text-sm font-semibold text-violet">Open Tax Settings</Link> : null}
    </section>
  );
}
