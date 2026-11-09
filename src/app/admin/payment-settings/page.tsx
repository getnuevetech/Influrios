import Link from "next/link";
import { requireAnyAdminModule } from "@/app/admin/guard";
import { prisma } from "@/lib/db";
import { decidePaymentRoute } from "@/lib/payment-route";
import { storedPayoutMethodList } from "@/lib/corridor-checkout";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment settings · Admin" };

export default async function PaymentSettingsPage() {
  await requireAnyAdminModule(["gateways", "collab_finance", "marketplace"]);
  const [corridors, jurisdictions, routes] = await Promise.all([
    prisma.countryActivationCorridor.findMany({ orderBy: { countryCode: "asc" } }),
    prisma.collaborationJurisdiction.findMany({ orderBy: { code: "asc" } }),
    prisma.paymentCountryRoute.findMany({ include: { provider: { select: { code: true, enabled: true, name: true } } } }),
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
          One place for how a country collects, holds, and pays out. Credentials stay on providers. A country route is the
          corridor, the jurisdiction rules, and the gateway assignment together. A deal stores the route it used, so a
          later edit does not reroute money already in motion.
        </p>
      </div>
      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/admin/gateways" className="rounded-2xl border border-[#E4EBFF] bg-white p-4">
          <p className="font-display text-lg font-bold text-indigo">Providers</p>
          <p className="mt-1 text-xs text-muted">Gateway credentials and which countries a gateway can serve.</p>
        </Link>
        <Link href="/admin/corridors" className="rounded-2xl border border-[#E4EBFF] bg-white p-4">
          <p className="font-display text-lg font-bold text-indigo">Country routes</p>
          <p className="mt-1 text-xs text-muted">Activation, currency, collection provider, and payout methods.</p>
        </Link>
        <Link href="/admin/marketplace/settings" className="rounded-2xl border border-[#E4EBFF] bg-white p-4">
          <p className="font-display text-lg font-bold text-indigo">Policies</p>
          <p className="mt-1 text-xs text-muted">Jurisdiction eligibility, holding provider, and funding schedules.</p>
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
    </div>
  );
}
