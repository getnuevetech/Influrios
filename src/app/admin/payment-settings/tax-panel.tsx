import { actionLinkFeeTaxPolicy, actionSaveTaxPolicy } from "@/app/admin/payment-standard/actions";
import { prisma } from "@/lib/db";
import { routeReadiness } from "@/lib/payment-standard-v4";

export async function TaxPoliciesPanel() {
  const [policies, rules, routes] = await Promise.all([
    prisma.taxPolicyVersion.findMany({ orderBy: { createdAt: "desc" }, take: 30 }).catch(() => []),
    prisma.collaborationFeeRule.findMany({ where: { active: true }, orderBy: { name: "asc" }, take: 40, select: { id: true, name: true, purpose: true, payer: true, taxPolicyId: true } }).catch(() => []),
    prisma.paymentRouteVersion.findMany({ orderBy: { createdAt: "desc" }, take: 20 }).catch(() => []),
  ]);
  const readiness = routeReadiness({
    domesticRule: true,
    currency: true,
    cardMethod: true,
    holdingEvidence: false,
    payoutMethod: true,
    refundSupport: true,
    bankPayoutControl: false,
    verificationWorkflow: true,
    taxOwner: policies.some((row) => row.status === "active" && row.filingOwner.trim().length > 0),
    productionApproval: false,
    allocatedFundsApproved: routes.some((row) => row.allocatedFundsApproved),
  });
  return (
    <div data-screen="A02" className="mx-auto max-w-5xl space-y-6 px-4">
      <section className="rounded-2xl border border-border bg-white p-5">
        <h2 className="font-display text-xl font-bold">Tax policy</h2>
        <p className="mt-1 text-sm text-muted">Saving a draft does not charge tax and does not enable a country route. There is no universal tax amount.</p>
        <form action={actionSaveTaxPolicy} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Name<input name="name" required className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
          <label className="text-sm">Liable entity<input name="liableEntity" className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
          <label className="text-sm">Treatment
            <select name="treatment" className="mt-1 w-full rounded-xl border px-3 py-2">
              {["unresolved", "taxable", "exempt", "non_taxable", "no_collection_obligation"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="text-sm">Customer
            <select name="customerRole" className="mt-1 w-full rounded-xl border px-3 py-2">
              <option value="business">Business fee</option>
              <option value="influencer">Influencer fee</option>
              <option value="subscriber">Subscription</option>
            </select>
          </label>
          <label className="text-sm">Jurisdiction<input name="jurisdiction" placeholder="US-CA" className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
          <label className="text-sm">Classification<input name="classification" className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
          <label className="text-sm">Filing owner<input name="filingOwner" className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
          <label className="text-sm">Rate basis points<input name="rateBps" inputMode="numeric" className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="inclusive" /> Inclusive price</label>
          <label className="text-sm sm:col-span-2">Notes<textarea name="notes" className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
          <button type="submit" className="h-11 rounded-full bg-violet px-4 text-sm font-semibold text-white">Save draft version</button>
        </form>
      </section>
      <section className="rounded-2xl border border-border bg-white p-5 text-sm">
        <h2 className="font-display text-xl font-bold">Link a fee rule</h2>
        <form action={actionLinkFeeTaxPolicy} className="mt-3 flex flex-wrap gap-2">
          <select name="ruleId" className="h-11 rounded-xl border px-3">
            {rules.map((rule) => <option key={rule.id} value={rule.id}>{rule.name} · {rule.purpose} · {rule.payer}</option>)}
          </select>
          <select name="taxPolicyId" className="h-11 rounded-xl border px-3">
            <option value="">No tax profile</option>
            {policies.map((policy) => <option key={policy.id} value={policy.id}>{policy.name} v{policy.version} · {policy.treatment}</option>)}
          </select>
          <button type="submit" className="h-11 rounded-full border px-4 text-sm font-semibold">Link</button>
        </form>
        <p className="mt-3 text-xs text-muted">A fee rule never turns funding on. {readiness.blocker ?? "Route readiness still depends on the country route."}</p>
      </section>
      <section data-screen="A01" className="rounded-2xl border border-border bg-white p-5">
        <h2 className="font-display text-xl font-bold">Route versions</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {routes.length === 0 ? <li>No v4 route version yet. Drafts stay off until provider approval.</li> : routes.map((route) => (
            <li key={route.id}>{route.countryCode} v{route.version} · {route.environment} · {route.currency} · collections {route.newCollectionsEnabled ? "on" : "off"} · {route.allocatedFundsApproved ? "allocation approved" : "Provider approval required"}</li>
          ))}
        </ul>
        <ul className="mt-4 space-y-1 text-sm">
          {readiness.checks.map((check) => (
            <li key={check.label}>{check.ready ? "Ready" : "Missing"} · {check.label}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
