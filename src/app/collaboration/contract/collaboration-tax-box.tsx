import { COUNTRY_TAX_FIELDS, collaborationCheckout } from "@/lib/country-tax";
import { loadCountryRules } from "@/lib/tax-settings";

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export async function CollaborationTaxBox({
  country,
  currency,
  compensationCents,
  businessFeeCents,
  influencerFeeCents,
}: {
  country: string;
  currency: string;
  compensationCents: number;
  businessFeeCents: number;
  influencerFeeCents: number;
}) {
  const rules = await loadCountryRules().catch(() => []);
  const checkout = collaborationCheckout({
    rules,
    countryCode: country,
    currency,
    compensationCents,
    businessFeeCents,
    influencerFeeCents,
    at: new Date().toISOString(),
  });
  if (!checkout.ok) {
    return <p className="mt-3 text-sm font-semibold text-amber-800">{checkout.error} Nothing was charged.</p>;
  }
  return (
    <div className="mt-3">
      <dl className="grid gap-2 sm:grid-cols-2">
        {checkout.lines.map((line) => (
          <div key={line.label}>
            <dt className="text-xs text-muted">{line.label}</dt>
            <dd className="font-semibold text-indigo">{money(line.amountCents, currency)}{line.reason && line.amountCents === 0 ? ` · ${line.reason}` : ""}</dd>
          </div>
        ))}
      </dl>
      {checkout.showDetails ? (
        <details className="mt-2 text-xs text-muted">
          <summary className="cursor-pointer font-semibold text-violet">{COUNTRY_TAX_FIELDS.viewDetails}</summary>
          <ul className="mt-2 space-y-1">
            {checkout.details.map((line) => (
              <li key={line.label}>{line.label}: {line.taxCents === 0 ? "Tax $0.00" : money(line.taxCents, currency)} · {line.reason}</li>
            ))}
          </ul>
        </details>
      ) : null}
      <p className="mt-2 text-xs text-muted">This is the amount to fund. Milestone releases use these tax records and do not charge tax again.</p>
    </div>
  );
}
