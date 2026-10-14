import Link from "next/link";
import {
  actionCreateCorridor,
  actionDeleteCorridorGroup,
  actionSaveCorridorGroup,
  actionSavePayoutFallback,
  actionToggleCorridor,
  actionUpdateCorridor,
} from "@/app/admin/corridors/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { AdminCollapse } from "@/components/admin-collapse";
import { hasPermission } from "@/lib/admin-auth";
import { listCorridorGroups, listCorridorsForAdmin, payoutMethodOptions } from "@/lib/collab-control-plane";
import {
  corridorCountryByCode,
  corridorCountryLabel,
  corridorCurrencyOptions,
  countriesAvailableForCorridor,
} from "@/lib/corridor-countries";
import { KYC_TYPES, kycTypeByCode } from "@/lib/kyc-types";
import { loadPayoutFallbackCurrency } from "@/lib/payout-readiness";
import { listProviders } from "@/lib/providers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Country corridors · Admin" };

const selectClass = "mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo";

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };
type CorridorRow = Awaited<ReturnType<typeof listCorridorsForAdmin>>[number];
type ProviderOption = { code: string; name: string };
type MethodOption = { method: string; label: string };

function corridorHeading(row: Pick<CorridorRow, "countryCode" | "currency">) {
  const country = corridorCountryByCode(row.countryCode);
  return `${country?.name ?? row.countryCode} — ${row.currency}`;
}

function groupSubtitle(codes: string[], corridors: CorridorRow[]) {
  const byCode = new Map(corridors.map((row) => [row.countryCode, row]));
  const labels = codes.map((code) => {
    const row = byCode.get(code);
    return row ? corridorHeading(row) : code;
  });
  const shown = labels.slice(0, 4).join(", ");
  return labels.length > 4 ? `${codes.length} countries · ${shown}, …` : `${codes.length} countries · ${shown}`;
}

function KycSelect({ value }: { value: string }) {
  const current = kycTypeByCode(value);
  return (
    <select name="kycModel" required defaultValue={current?.code ?? ""} className={selectClass}>
      <option value="" disabled>
        Choose a KYC type
      </option>
      {KYC_TYPES.map((type) => (
        <option key={type.code} value={type.code}>
          {type.label}
        </option>
      ))}
    </select>
  );
}

function CurrencySelect({ value }: { value: string }) {
  return (
    <select name="currency" defaultValue={value} className={selectClass}>
      {corridorCurrencyOptions(value).map((code) => (
        <option key={code} value={code}>
          {code}
        </option>
      ))}
    </select>
  );
}

function RouteSelect({ value, providers }: { value: string; providers: ProviderOption[] }) {
  const known = providers.some((provider) => provider.code === value);
  return (
    <select name="collectionProviderCode" defaultValue={value} className={selectClass}>
      <option value="">No collection route</option>
      {value && !known ? <option value={value}>{value}</option> : null}
      {providers.map((provider) => (
        <option key={provider.code} value={provider.code}>
          {provider.name}
        </option>
      ))}
    </select>
  );
}

function CountryMultiSelect({ corridors, selected }: { corridors: CorridorRow[]; selected: string[] }) {
  const options = [...corridors].sort((a, b) => corridorHeading(a).localeCompare(corridorHeading(b)));
  return (
    <select name="countryCode" multiple required size={8} defaultValue={selected} className={selectClass}>
      {options.map((row) => (
        <option key={row.countryCode} value={row.countryCode}>
          {corridorHeading(row)}
        </option>
      ))}
    </select>
  );
}

function CorridorCard({
  row,
  canManage,
  methods,
  providers,
}: {
  row: CorridorRow;
  canManage: boolean;
  methods: MethodOption[];
  providers: ProviderOption[];
}) {
  const selected = Array.isArray(row.payoutMethodsJson) ? (row.payoutMethodsJson as string[]) : [];
  return (
    <AdminCollapse
      title={corridorHeading(row)}
      subtitle={`${row.collectionProviderCode ?? "no collection route"} · ${kycTypeByCode(row.kycModel)?.label ?? "KYC type not chosen"} · ${row.active ? "Active" : "Suspended"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        {canManage ? (
          <form action={actionToggleCorridor}>
            <input type="hidden" name="countryCode" value={row.countryCode} />
            <input type="hidden" name="active" value={row.active ? "0" : "1"} />
            <button type="submit" className="btn-secondary !px-3 !py-1.5 text-xs">
              {row.active ? "Suspend corridor" : "Activate corridor"}
            </button>
          </form>
        ) : null}
      </div>

      {canManage ? (
        <form action={actionUpdateCorridor} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="countryCode" value={row.countryCode} />
          <label className="text-xs font-semibold text-muted">
            Currency
            <CurrencySelect value={row.currency} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Collection route
            <RouteSelect value={row.collectionProviderCode ?? ""} providers={providers} />
          </label>
          <label className="text-xs font-semibold text-muted sm:col-span-2">
            KYC type
            <KycSelect value={row.kycModel} />
          </label>
          <label className="text-xs font-semibold text-muted">
            Notes
            <input
              name="notes"
              defaultValue={row.notes}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-indigo">
            <input type="checkbox" name="holdingEnabled" value="1" defaultChecked={row.holdingEnabled} />
            Holding enabled
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-indigo">
            <input type="checkbox" name="fxEnabled" value="1" defaultChecked={row.fxEnabled} />
            FX enabled
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="text-xs font-semibold text-muted">Payout methods</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {methods.map((method) => (
                <label key={method.method} className="flex items-center gap-2 text-xs text-indigo">
                  <input
                    type="checkbox"
                    name="payoutMethod"
                    value={method.method}
                    defaultChecked={selected.includes(method.method)}
                  />
                  {method.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary !px-4 !py-2 text-xs">
              Save corridor
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-3 text-xs text-muted">{row.notes || "No notes."}</p>
      )}
    </AdminCollapse>
  );
}

export default async function AdminCorridorsPage({ searchParams }: Props) {
  const session = await requireAdminPage("collab_finance");
  const canManage = hasPermission(session, "collab_finance.manage");
  const params = await searchParams;
  const corridors = await listCorridorsForAdmin().catch(() => []);
  const groups = await listCorridorGroups().catch(() => []);
  const fallbackCurrency = await loadPayoutFallbackCurrency().catch(() => "USD");
  const providers = await listProviders("payment")
    .then((rows) => rows.map((row) => ({ code: row.code, name: row.name })))
    .catch(() => [] as ProviderOption[]);
  const methods = payoutMethodOptions();
  const available = countriesAvailableForCorridor(corridors.map((row) => row.countryCode));
  const groupedCodes = new Set(groups.flatMap((group) => group.members.map((member) => member.countryCode)));
  const ungrouped = corridors.filter((row) => !groupedCodes.has(row.countryCode));
  const byCode = new Map(corridors.map((row) => [row.countryCode, row]));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Country activation corridors</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Corridors control collaboration collection, influencer payout onboarding, payout methods, and KYC for each
          country. Add a country from the list (full name + currency letters for a new payout profile). The collection
          route is a gateway saved on Payment gateways — for example Airwallex for Nigeria routes influencers to
          Airwallex setup, not Stripe Connect. KYC type is either KYC by Gateway or KYC by Document Upload. Group
          countries to keep this list short. An existing payout profile keeps the currency it already stored.
        </p>
        <p className="mt-2 text-xs text-muted">
          Also see{" "}
          <Link href="/admin/collaboration-ops" className="font-semibold text-violet hover:underline">
            Collaboration operations
          </Link>{" "}
          and{" "}
          <Link href="/admin/gateways" className="font-semibold text-violet hover:underline">
            Payment gateways
          </Link>
          .
        </p>
      </div>

      {params.saved ? (
        <p className="text-sm font-semibold text-emerald-700">Saved ({params.saved}).</p>
      ) : null}
      {params.error ? <p className="text-sm font-semibold text-amber-800">{params.error}</p> : null}

      <article className="rounded-2xl border border-[#E4EBFF] bg-white p-4 shadow-sm">
        <h2 className="font-display text-lg font-bold text-indigo">Backup currency</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          A country with no corridor uses this code on a new payout profile. It starts as USD.
        </p>
        {canManage ? (
          <form action={actionSavePayoutFallback} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-muted">
              Backup currency
              <select name="payoutFallbackCurrency" defaultValue={fallbackCurrency} className="mt-1 w-28 rounded-lg border border-border px-3 py-2 text-sm text-indigo">
                {corridorCurrencyOptions(fallbackCurrency).map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-primary !px-4 !py-2 text-xs">
              Save backup currency
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm font-semibold text-indigo">{fallbackCurrency}</p>
        )}
      </article>

      <article className="rounded-2xl border border-[#E4EBFF] bg-white p-4 shadow-sm">
        <h2 className="font-display text-lg font-bold text-indigo">Add a country</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Choose the country and a collection route. The currency in the country name is stored on the new corridor.
        </p>
        {canManage && available.length > 0 ? (
          <form action={actionCreateCorridor} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted">
              Country
              <select name="countryCode" required defaultValue="" className={selectClass}>
                <option value="" disabled>
                  Choose a country
                </option>
                {available.map((country) => (
                  <option key={country.code} value={country.code}>
                    {corridorCountryLabel(country)}
                  </option>
                ))}
              </select>
            </label>
          <label className="text-xs font-semibold text-muted">
            Collection route
            <RouteSelect value="" providers={providers} />
          </label>
          <label className="text-xs font-semibold text-muted sm:col-span-2">
            KYC type
            <KycSelect value="" />
          </label>
            <fieldset className="sm:col-span-2">
              <legend className="text-xs font-semibold text-muted">Payout methods</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {methods.map((method) => (
                  <label key={method.method} className="flex items-center gap-2 text-xs text-indigo">
                    <input
                      type="checkbox"
                      name="payoutMethod"
                      value={method.method}
                      defaultChecked={method.method === "local_bank"}
                    />
                    {method.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary !px-4 !py-2 text-xs">
                Add country
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted">
            {available.length === 0 ? "Every country in the list already has a corridor." : "You can view corridors."}
          </p>
        )}
      </article>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-bold text-indigo">Country groups</h2>
          <p className="mt-1 text-sm text-muted">
            Fold countries into a named group and choose one KYC type for that group. Saving writes the type onto
            every country in the group. Each country keeps its own currency and collection route, and you can change
            one country’s KYC type afterward.
          </p>
          <p className="mt-2 text-xs text-muted">
            Define the gateway and the government-ID details on{" "}
            <Link href="/admin/kyc" className="font-semibold text-violet hover:underline">
              KYC
            </Link>
            .
          </p>
          <ul className="mt-2 max-w-3xl space-y-1 text-xs text-muted">
            {KYC_TYPES.map((type) => (
              <li key={type.code}>
                <span className="font-semibold text-indigo">{type.label}.</span> {type.detail}
              </li>
            ))}
          </ul>
        </div>
        {groups.map((group) => {
          const codes = group.members.map((member) => member.countryCode);
          const members = codes.map((code) => byCode.get(code)).filter((row): row is CorridorRow => Boolean(row));
          return (
            <AdminCollapse
              key={group.id}
              title={group.name}
              subtitle={`${kycTypeByCode(group.kycModel)?.label ?? "KYC type not chosen"} · ${groupSubtitle(codes, corridors)}`}
            >
              {canManage ? (
                <form action={actionSaveCorridorGroup} className="grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="id" value={group.id} />
                  <label className="text-xs font-semibold text-muted">
                    Group name
                    <input
                      name="name"
                      required
                      defaultValue={group.name}
                      className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
                    />
                  </label>
                  <label className="text-xs font-semibold text-muted">
                    KYC type
                    <KycSelect value={group.kycModel} />
                  </label>
                  <label className="text-xs font-semibold text-muted sm:col-span-2">
                    Countries
                    <CountryMultiSelect corridors={corridors} selected={codes} />
                  </label>
                  <button type="submit" className="btn-primary w-fit !px-4 !py-2 text-xs">
                    Save group
                  </button>
                </form>
              ) : null}
              {canManage ? (
                <form action={actionDeleteCorridorGroup} className="mt-3">
                  <input type="hidden" name="id" value={group.id} />
                  <button type="submit" className="text-xs font-semibold text-amber-800 hover:underline">
                    Remove group
                  </button>
                </form>
              ) : null}
              <div className="mt-4 space-y-3">
                {members.map((row) => (
                  <CorridorCard key={row.countryCode} row={row} canManage={canManage} methods={methods} providers={providers} />
                ))}
              </div>
            </AdminCollapse>
          );
        })}
        {canManage && corridors.length > 0 ? (
          <form
            action={actionSaveCorridorGroup}
            className="grid gap-3 rounded-2xl border border-dashed border-[#E4EBFF] bg-white p-4 sm:grid-cols-2"
          >
            <h3 className="font-semibold text-indigo sm:col-span-2">Add a group</h3>
            <label className="text-xs font-semibold text-muted">
              Group name
              <input
                name="name"
                required
                placeholder="East Africa"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              KYC type
              <KycSelect value="" />
            </label>
            <label className="text-xs font-semibold text-muted sm:col-span-2">
              Countries
              <CountryMultiSelect corridors={corridors} selected={[]} />
            </label>
            <button type="submit" className="btn-secondary w-fit !px-4 !py-2 text-xs">
              Create group
            </button>
          </form>
        ) : null}
      </section>

      <AdminCollapse
        title="Not in a group"
        subtitle={groupSubtitle(
          ungrouped.map((row) => row.countryCode),
          corridors,
        )}
        defaultOpen={groups.length === 0}
      >
        {ungrouped.length === 0 ? (
          <p className="text-sm text-muted">Every corridor is in a group.</p>
        ) : (
          <div className="space-y-3">
            {ungrouped.map((row) => (
              <CorridorCard key={row.countryCode} row={row} canManage={canManage} methods={methods} providers={providers} />
            ))}
          </div>
        )}
      </AdminCollapse>
    </div>
  );
}
