import Link from "next/link";
import { actionRecordProviderTrace, actionSaveCanonicalCountryRoute, actionSaveLaunchApprovals } from "@/app/admin/payment-settings/actions";
import { getLaunchGate } from "@/lib/launch-gate";
import { requireAnyAdminModule } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { decidePaymentRoute } from "@/lib/payment-route";
import { storedPayoutMethodList } from "@/lib/corridor-checkout";
import { corridorCurrencyOptions } from "@/lib/corridor-countries";
import { listProviders } from "@/lib/providers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment settings · Admin" };

export default async function PaymentSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await requireAnyAdminModule(["gateways", "collab_finance", "marketplace"]);
  const canEdit = hasPermission(session, "collab_finance.manage");
  const canApprove = hasPermission(session, "marketplace.manage");
  const launchGate = await getLaunchGate().catch(() => null);
  const params = await searchParams;
  const [corridors, jurisdictions, routes, gateways, marketplaceProviders] = await Promise.all([
    prisma.countryActivationCorridor.findMany({ orderBy: { countryCode: "asc" } }),
    prisma.collaborationJurisdiction.findMany({ orderBy: { code: "asc" } }),
    prisma.paymentCountryRoute.findMany({ include: { provider: { select: { code: true, enabled: true, name: true } } } }),
    listProviders("payment").catch(() => []),
    prisma.integrationProvider.findMany({ where: { kind: "marketplace" }, orderBy: { code: "asc" } }),
  ]);
  const corridorByCode = new Map(corridors.map((row) => [row.countryCode, row]));
  const jurisdictionByCode = new Map(jurisdictions.map((row) => [row.code, row]));
  const routeByCode = new Map(routes.map((row) => [row.countryCode, row]));
  const codes = [...new Set([...corridorByCode.keys(), ...jurisdictionByCode.keys(), ...routeByCode.keys()])].sort();
  const decisions = codes.map((code) => {
    const corridor = corridorByCode.get(code);
    const jurisdiction = jurisdictionByCode.get(code);
    const route = routeByCode.get(code);
    return decidePaymentRoute({
      countryCode: code,
      corridorActive: corridor?.active,
      corridorCurrency: corridor?.currency,
      corridorCollectionProvider: corridor?.collectionProviderCode,
      corridorPayoutMethods: storedPayoutMethodList(corridor?.payoutMethodsJson),
      jurisdictionCurrency: jurisdiction?.currency,
      jurisdictionMinorDigits: jurisdiction?.minorDigits,
      jurisdictionHoldingProvider: jurisdiction?.providerCode,
      jurisdictionProtectedPayments: jurisdiction?.protectedPaymentsEnabled,
      gatewayProvider: route?.provider.code,
      gatewayActive: route ? route.active && route.provider.enabled : null,
    });
  });
  const conflicts = decisions.filter((row) => row.conflicts.length > 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-indigo">Payment settings</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          This page is the only editor for a country’s currency, precision, collection provider, holding provider, and
          payout gateway. Provider credentials stay on Providers. Fee rules stay on Fees. A deal stores the route it
          used, so a later edit does not reroute money already in motion.
        </p>
      </div>
      {params.error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{params.error}</p>
      ) : null}
      {params.saved ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          Saved {params.saved}.
        </p>
      ) : null}
      <section className="rounded-2xl border border-[#E4EBFF] bg-white p-4">
        <h2 className="font-display text-lg font-bold text-indigo">Launch approvals</h2>
        <p className="mt-1 text-sm text-muted">
          Live collection stays off until all four approvals are saved and a reconciled payout trace and refund trace
          are recorded. Saving this form does not charge a deal.
        </p>
        <p className="mt-2 text-xs font-semibold text-indigo">
          Trace: {launchGate?.providerTraceReady ? "recorded" : "not recorded"}
        </p>
        {canApprove ? (
          <form action={actionSaveLaunchApprovals} className="mt-3 grid gap-2 text-sm">
            <label className="flex gap-2"><input type="checkbox" name="feeSchedulesApproved" defaultChecked={launchGate?.feeSchedulesApproved} /> Fee schedules approved</label>
            <label className="flex gap-2"><input type="checkbox" name="taxTreatmentApproved" defaultChecked={launchGate?.taxTreatmentApproved} /> Tax treatment approved</label>
            <label className="flex gap-2"><input type="checkbox" name="earningRefundPolicyApproved" defaultChecked={launchGate?.earningRefundPolicyApproved} /> Fee earning and refund policy approved</label>
            <label className="flex gap-2"><input type="checkbox" name="providerRouteApproved" defaultChecked={launchGate?.providerRouteApproved} /> Provider route approved</label>
            <input name="reason" required minLength={8} placeholder="Reason for this change" className="rounded-lg border px-3 py-2" />
            <button className="w-fit rounded-full bg-indigo px-4 py-2 text-xs font-bold text-white">Save approvals</button>
          </form>
        ) : (
          <p className="mt-2 text-xs text-muted">Finance can change these approvals.</p>
        )}
        {canApprove ? (
          <form action={actionRecordProviderTrace} className="mt-4 grid gap-2 border-t border-[#E4EBFF] pt-4 text-sm sm:grid-cols-2">
            <p className="sm:col-span-2 text-xs text-muted">
              Enter the staging amounts and redacted provider references from one funded payout and one confirmed refund.
              The trace is stored only when collection equals the payout plus fees plus tax.
            </p>
            <input name="currency" required placeholder="Currency" className="rounded-lg border px-3 py-2" />
            <input name="businessPaysCents" required inputMode="numeric" placeholder="Business pays, minor units" className="rounded-lg border px-3 py-2" />
            <input name="influencerReceivesCents" required inputMode="numeric" placeholder="Influencer receives, minor units" className="rounded-lg border px-3 py-2" />
            <input name="platformFeesTotalCents" required inputMode="numeric" placeholder="Platform fees, minor units" className="rounded-lg border px-3 py-2" />
            <input name="taxCents" required inputMode="numeric" placeholder="Tax, minor units" className="rounded-lg border px-3 py-2" />
            <input name="collectionRef" required minLength={4} placeholder="Collection reference" className="rounded-lg border px-3 py-2" />
            <input name="holdingRef" required minLength={4} placeholder="Holding reference" className="rounded-lg border px-3 py-2" />
            <input name="releaseRef" required minLength={4} placeholder="Release reference" className="rounded-lg border px-3 py-2" />
            <input name="payoutRef" required minLength={4} placeholder="Confirmed payout reference" className="rounded-lg border px-3 py-2" />
            <input name="refundRef" required minLength={4} placeholder="Confirmed refund reference" className="rounded-lg border px-3 py-2 sm:col-span-2" />
            <button className="w-fit rounded-full bg-indigo px-4 py-2 text-xs font-bold text-white">Record staging trace</button>
          </form>
        ) : null}
      </section>
      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/admin/gateways" className="rounded-2xl border border-[#E4EBFF] bg-white p-4">
          <p className="font-display text-lg font-bold text-indigo">Providers</p>
          <p className="mt-1 text-xs text-muted">Gateway credentials, Connect, and health. Country assignment is here.</p>
        </Link>
        <Link href="/admin/fees" className="rounded-2xl border border-[#E4EBFF] bg-white p-4">
          <p className="font-display text-lg font-bold text-indigo">Fees and policies</p>
          <p className="mt-1 text-xs text-muted">Business and influencer platform fee rules, waivers, and the simulator.</p>
        </Link>
        <Link href="/admin/billing" className="rounded-2xl border border-[#E4EBFF] bg-white p-4">
          <p className="font-display text-lg font-bold text-indigo">Subscription billing</p>
          <p className="mt-1 text-xs text-muted">Plan prices and the billing portal. Separate from collaboration funding.</p>
        </Link>
      </section>
      {conflicts.length > 0 ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-display text-lg font-bold text-amber-950">Route conflicts</h2>
          <ul className="mt-2 space-y-1 text-sm text-amber-950">
            {conflicts.flatMap((row) => row.conflicts.map((conflict) => <li key={conflict}>{conflict}</li>))}
          </ul>
          <p className="mt-2 text-xs text-amber-900">
            A new prefund is refused while a country has two currencies. Collection and the gateway assignment can differ.
          </p>
        </section>
      ) : (
        <p className="text-sm text-emerald-800">No country has two currencies.</p>
      )}
      <section className="overflow-x-auto rounded-2xl border border-[#E4EBFF] bg-white">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-[#E4EBFF] text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Country</th>
              <th className="px-4 py-3">Currency</th>
              <th className="px-4 py-3">Collection</th>
              <th className="px-4 py-3">Holding</th>
              <th className="px-4 py-3">Gateway</th>
              <th className="px-4 py-3">Route</th>
            </tr>
          </thead>
          <tbody>
            {decisions.map((row) => (
              <tr key={row.countryCode} className="border-b border-[#E4EBFF] last:border-0">
                <td className="px-4 py-3 font-semibold text-indigo">{row.countryCode}</td>
                <td className="px-4 py-3">{row.currency ?? "—"}</td>
                <td className="px-4 py-3">{row.collectionProvider ?? "—"}</td>
                <td className="px-4 py-3">{row.holdingProvider ?? "—"}</td>
                <td className="px-4 py-3">{row.payoutRouteProvider ?? "—"}</td>
                <td className="px-4 py-3 text-xs">{row.blockedReason ?? `Ready · ${row.version}`}</td>
              </tr>
            ))}
            {decisions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-muted">
                  No corridors, jurisdictions, or gateway routes are saved.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-indigo">Edit a country route</h2>
        {codes.map((code) => {
          const corridor = corridorByCode.get(code);
          const jurisdiction = jurisdictionByCode.get(code);
          const route = routeByCode.get(code);
          if (!corridor || !jurisdiction) return null;
          return (
            <form key={code} action={actionSaveCanonicalCountryRoute} className="rounded-2xl border border-[#E4EBFF] bg-white p-4">
              <p className="font-display text-lg font-bold text-indigo">{code}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-5">
                <input type="hidden" name="countryCode" value={code} />
                <label className="text-xs font-semibold text-muted">
                  Currency
                  <select name="currency" defaultValue={corridor.currency} disabled={!canEdit} className="mt-1 w-full rounded-lg border border-border px-2 py-2 text-sm">
                    {corridorCurrencyOptions(corridor.currency).map((currency) => (
                      <option key={currency} value={currency}>{currency}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-muted">
                  Minor digits
                  <input name="minorDigits" defaultValue={jurisdiction.minorDigits} disabled={!canEdit} className="mt-1 w-full rounded-lg border border-border px-2 py-2 text-sm" />
                </label>
                <label className="text-xs font-semibold text-muted">
                  Collection
                  <select name="collectionProviderCode" defaultValue={corridor.collectionProviderCode ?? ""} disabled={!canEdit} className="mt-1 w-full rounded-lg border border-border px-2 py-2 text-sm">
                    <option value="">None</option>
                    {gateways.map((provider) => (
                      <option key={provider.id} value={provider.code}>{provider.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-muted">
                  Holding
                  <select name="holdingProviderCode" defaultValue={jurisdiction.providerCode} disabled={!canEdit} className="mt-1 w-full rounded-lg border border-border px-2 py-2 text-sm">
                    {marketplaceProviders.map((provider) => (
                      <option key={provider.id} value={provider.code}>{provider.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-muted">
                  Payout gateway
                  <select name="payoutGatewayCode" defaultValue={route?.provider.code ?? ""} disabled={!canEdit} className="mt-1 w-full rounded-lg border border-border px-2 py-2 text-sm">
                    <option value="">Choose</option>
                    {gateways.map((provider) => (
                      <option key={provider.id} value={provider.code}>{provider.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              {canEdit ? (
                <button type="submit" className="btn-primary mt-3 !py-2 text-sm">Save {code}</button>
              ) : (
                <p className="mt-3 text-xs text-muted">Route edits need the collaboration finance permission.</p>
              )}
            </form>
          );
        })}
      </section>
    </div>
  );
}
