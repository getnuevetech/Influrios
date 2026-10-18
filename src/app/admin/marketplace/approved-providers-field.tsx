import type { MarketplaceProviderOption } from "@/app/admin/marketplace/provider-catalog";

/** Multi-select checkboxes for jurisdiction approvedProviderIds (empty = any assigned). */
export function ApprovedProvidersField({
  options,
  selected,
  disabled,
}: {
  options: MarketplaceProviderOption[];
  selected: string[];
  disabled?: boolean;
}) {
  const selectedSet = new Set(selected.map((code) => code.trim().toLowerCase()).filter(Boolean));
  return (
    <fieldset className="sm:col-span-3">
      <legend className="text-xs font-semibold text-muted">Approved providers</legend>
      <p className="mt-1 text-[11px] font-normal text-muted">
        From Payment gateways (+ Primary). None selected = any assigned provider is allowed. New gateways appear here
        automatically.
      </p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {options.map((row) => (
          <li key={row.code}>
            <label className="flex items-start gap-2 text-sm text-indigo">
              <input
                type="checkbox"
                name="approvedProviderIds"
                value={row.code}
                defaultChecked={selectedSet.has(row.code)}
                disabled={disabled}
                className="mt-0.5 accent-violet"
              />
              <span>
                <span className="font-semibold">{row.name}</span>
                <span className="block text-[11px] text-muted">{row.detail}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
