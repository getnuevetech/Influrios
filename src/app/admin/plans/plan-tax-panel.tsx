import { actionSavePlanTax } from "@/app/admin/payment-standard/actions";
import { prisma } from "@/lib/db";

export async function PlanTaxPanel({ canEdit }: { canEdit: boolean }) {
  const [plans, policies] = await Promise.all([
    prisma.entitlementPlan.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, code: true, taxCode: true, taxBehavior: true, taxPolicyId: true, amountCents: true } }).catch(() => []),
    prisma.taxPolicyVersion.findMany({ where: { customerRole: "subscriber" }, orderBy: { createdAt: "desc" }, take: 20 }).catch(() => []),
  ]);
  return (
    <section data-screen="S01" className="space-y-4">
      <h2 className="font-display text-2xl font-bold text-indigo">Tax configuration</h2>
      <p className="text-sm text-muted">Tax code, behaviour, and profile. The preview is calculated. There is no flat tax amount field.</p>
      {plans.map((plan) => (
        <form key={plan.id} action={actionSavePlanTax} className="grid gap-3 rounded-2xl border border-border bg-white p-4 sm:grid-cols-2">
          <input type="hidden" name="planId" value={plan.id} />
          <p className="font-semibold sm:col-span-2">{plan.name} · {plan.code}</p>
          <label className="text-sm">Tax code<input name="taxCode" defaultValue={plan.taxCode} disabled={!canEdit} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
          <label className="text-sm">Tax behaviour
            <select name="taxBehavior" defaultValue={plan.taxBehavior} disabled={!canEdit} className="mt-1 w-full rounded-xl border px-3 py-2">
              <option value="">Not set</option>
              <option value="exclusive">exclusive</option>
              <option value="inclusive">inclusive</option>
            </select>
          </label>
          <label className="text-sm sm:col-span-2">Tax profile
            <select name="taxPolicyId" defaultValue={plan.taxPolicyId} disabled={!canEdit} className="mt-1 w-full rounded-xl border px-3 py-2">
              <option value="">None</option>
              {policies.map((policy) => <option key={policy.id} value={policy.id}>{policy.name} v{policy.version}</option>)}
            </select>
          </label>
          <p className="text-xs text-muted sm:col-span-2">Calculated tax stays empty until a jurisdiction rate and billing address are present. Price {plan.amountCents} minor units is not a tax.</p>
          {canEdit ? <button type="submit" className="h-11 rounded-full bg-violet px-4 text-sm font-semibold text-white">Save tax configuration</button> : null}
        </form>
      ))}
    </section>
  );
}
