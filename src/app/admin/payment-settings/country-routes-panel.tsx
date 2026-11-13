import Link from "next/link";
import { actionRecordProviderTrace, actionSaveCanonicalCountryRoute, actionSaveDeferredFunding, actionSaveLaunchApprovals, actionSaveProcessTimings } from "@/app/admin/payment-settings/actions";
import { paymentSettingsParams } from "@/app/admin/payment-settings/owner";
import { ReviewBeforeSave } from "@/components/review-before-save";
import { getLaunchGate } from "@/lib/launch-gate";
import { loadProcessTimings } from "@/lib/process-timing";
import { requireAnyAdminModule } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { decidePaymentRoute, sharedRouteChannelOptions } from "@/lib/payment-route";
import { storedPayoutMethodList } from "@/lib/corridor-checkout";
import { corridorCountryByCode, corridorCurrencyOptions } from "@/lib/corridor-countries";
import { listProviders } from "@/lib/providers";

export async function CountryRoutesPanel({
  searchParams,
  canAddCountry = false,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  canAddCountry?: boolean;
}) {
  const session = await requireAnyAdminModule(["gateways", "collab_finance", "marketplace"]);
  const canEdit = hasPermission(session, "collab_finance.manage");
  const canApprove = hasPermission(session, "marketplace.manage");
  const launchGate = await getLaunchGate().catch(() => null);
  const timing = await loadProcessTimings().catch(() => null);
  const params = paymentSettingsParams(await searchParams);
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
  const channelOptions = sharedRouteChannelOptions({
    payment: gateways.map((row) => ({ code: row.code, name: row.name })),
    marketplace: marketplaceProviders.map((row) => ({ code: row.code, name: row.name })),
    selected: [
      ...corridors.map((row) => row.collectionProviderCode),
      ...jurisdictions.map((row) => row.providerCode),
      ...routes.map((row) => row.provider.code),
    ],
  });
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-indigo">Country routes</h2>
            <p className="mt-2 max-w-3xl text-sm text-muted">
              Set which provider and currency to use for each creator country. This is the only editor for currency,
              precision, collection, holding, and the payout gateway. A deal stores the route it used, so a later edit
              does not reroute money already in motion.
            </p>
          </div>
          {canAddCountry ? (
            <a href="#add-country-route" className="rounded-full bg-[#5836D6] px-4 py-2 text-sm font-bold text-white">
              Add country route
            </a>
          ) : null}
        </div>
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
        <h3 className="mt-4 font-display text-base font-bold text-indigo">Process clocks</h3>
        <p className="mt-1 text-sm text-muted">
          These clocks start at the previous fixed values. A review window is copied onto a milestone when it is funded, and a quote expiry is copied when the deal is signed. The other clocks are read each time the job runs. A country can still set its own review window on Marketplace settings. Attribution days and the recurring interval stay on that page too. Login lockout, webhook signature age, and mail timeouts stay fixed.
        </p>
        {canApprove && timing ? (
          <form action={actionSaveProcessTimings} className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <label>Review window, hours<input name="reviewWindowHours" type="number" min={1} max={720} required defaultValue={timing.reviewWindowHours} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            <label>Review notice lead, hours<input name="reviewDeadlineLeadHours" type="number" min={1} max={168} required defaultValue={timing.reviewDeadlineLeadHours} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            <label>Quote life, hours<input name="quoteValidHours" type="number" min={1} max={2160} required defaultValue={timing.quoteValidHours} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            <label>Unknown command wait, minutes<input name="unknownCommandMinutes" type="number" min={1} max={1440} required defaultValue={timing.unknownCommandMinutes} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            <label>Provider command attempts<input name="providerCommandMaxAttempts" type="number" min={1} max={10} required defaultValue={timing.providerCommandMaxAttempts} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            <label>Dispute reminder, hours<input name="disputeSlaHours" type="number" min={1} max={720} required defaultValue={timing.disputeSlaHours} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            <label>Hold warning, hours<input name="providerHoldWarnHours" type="number" min={1} max={2160} required defaultValue={timing.providerHoldWarnHours} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            <label>Stale funding, hours<input name="staleFundingHours" type="number" min={1} max={720} required defaultValue={timing.staleFundingHours} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            <label>Failed payout attempts<input name="failedPayoutMaxAttempts" type="number" min={1} max={10} required defaultValue={timing.failedPayoutMaxAttempts} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            <label>Failed payout waits, hours<input name="failedPayoutBackoffHours" required defaultValue={timing.failedPayoutBackoffHours.join(",")} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            <label>Team proposal life, days<input name="teamProposalLifeDays" type="number" min={1} max={90} required defaultValue={timing.teamProposalLifeDays} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
            <button className="w-fit rounded-full bg-indigo px-4 py-2 text-xs font-bold text-white">Save process clocks</button>
          </form>
        ) : null}
        <h3 className="mt-4 font-display text-base font-bold text-indigo">Extra funding paths</h3>
        <p className="mt-1 text-sm text-muted">
          Each path stays off until it is saved here. Turning one on does not charge a deal and does not approve live collection.
        </p>
        {canApprove ? (
          <form action={actionSaveDeferredFunding} className="mt-3 grid gap-2 text-sm">
            <label className="flex gap-2"><input type="checkbox" name="crossBorderFundingEnabled" defaultChecked={launchGate?.crossBorderFundingEnabled} /> Cross-border funding</label>
            <label className="flex gap-2"><input type="checkbox" name="teamFundingEnabled" defaultChecked={launchGate?.teamFundingEnabled} /> Team funding</label>
            <label className="flex gap-2"><input type="checkbox" name="stagedFundingEnabled" defaultChecked={launchGate?.stagedFundingEnabled} /> Staged funding</label>
            <label className="flex gap-2"><input type="checkbox" name="automaticMilestoneApprovalEnabled" defaultChecked={launchGate?.automaticMilestoneApprovalEnabled} /> Automatic milestone approval</label>
            <label className="flex gap-2"><input type="checkbox" name="automaticProviderSwitchingEnabled" defaultChecked={launchGate?.automaticProviderSwitchingEnabled} /> Automatic provider switching</label>
            <label className="flex gap-2"><input type="checkbox" name="allInBudgetEntryEnabled" defaultChecked={launchGate?.allInBudgetEntryEnabled} /> All-in budget entry</label>
            <p className="text-xs text-muted">
              Payout approval and the provider send live on Marketplace ledger → Payout release. Saving this form leaves those switches as they are.
            </p>
            <input name="reason" required minLength={8} placeholder="Reason for this change" className="rounded-lg border px-3 py-2" />
            <button className="w-fit rounded-full bg-indigo px-4 py-2 text-xs font-bold text-white">Save funding paths</button>
          </form>
        ) : null}
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
      <Link href="/admin/billing" className="block rounded-2xl border border-[#E4EBFF] bg-white p-4">
        <p className="font-display text-lg font-bold text-indigo">Subscription billing</p>
        <p className="mt-1 text-xs text-muted">Plan prices and the billing portal. Separate from collaboration funding.</p>
      </Link>
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
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {decisions.map((row) => {
              const country = corridorCountryByCode(row.countryCode);
              return (
                <tr key={row.countryCode} className="border-b border-[#E4EBFF] last:border-0">
                  <td className="px-4 py-3 font-semibold text-indigo">
                    {country?.name ?? row.countryCode}
                    <span className="mt-0.5 block text-xs font-normal text-muted">{row.countryCode}</span>
                  </td>
                  <td className="px-4 py-3">{row.currency ?? "Not configured"}</td>
                  <td className="px-4 py-3">{row.collectionProvider ?? "Not configured"}</td>
                  <td className="px-4 py-3 text-xs">{row.blockedReason ?? "Enabled"}</td>
                  <td className="px-4 py-3">
                    <a href={`#route-${row.countryCode}`} className="text-xs font-semibold text-violet hover:underline">
                      Configure
                    </a>
                  </td>
                </tr>
              );
            })}
            {decisions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-muted">
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
            <ReviewBeforeSave
              key={code}
              formId={`route-${code}`}
              action={actionSaveCanonicalCountryRoute}
              kind="country-route"
              className="scroll-mt-24 rounded-2xl border border-[#E4EBFF] bg-white p-4"
              triggerLabel={canEdit ? `Save ${code}` : undefined}
              triggerClassName="btn-primary mt-3 !py-2 text-sm"
              confirmLabel="Save route"
            >
              <p className="font-display text-lg font-bold text-indigo">{corridorCountryByCode(code)?.name ?? code}</p>
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
                  <select name="collectionProviderCode" defaultValue={(corridor.collectionProviderCode ?? "").toLowerCase()} disabled={!canEdit} className="mt-1 w-full rounded-lg border border-border px-2 py-2 text-sm">
                    <option value="">None</option>
                    {channelOptions.map((provider) => (
                      <option key={provider.code} value={provider.code}>{provider.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-muted">
                  Primary marketplace
                  <select name="holdingProviderCode" defaultValue={jurisdiction.providerCode.toLowerCase()} disabled={!canEdit} className="mt-1 w-full rounded-lg border border-border px-2 py-2 text-sm">
                    {channelOptions.map((provider) => (
                      <option key={provider.code} value={provider.code}>{provider.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-muted">
                  Payout gateway
                  <select name="payoutGatewayCode" defaultValue={(route?.provider.code ?? "").toLowerCase()} disabled={!canEdit} className="mt-1 w-full rounded-lg border border-border px-2 py-2 text-sm">
                    <option value="">Choose</option>
                    {channelOptions.map((provider) => (
                      <option key={provider.code} value={provider.code}>{provider.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              {canEdit ? null : (
                <p className="mt-3 text-xs text-muted">Route edits need the collaboration finance permission.</p>
              )}
            </ReviewBeforeSave>
          );
        })}
      </section>
    </div>
  );
}

