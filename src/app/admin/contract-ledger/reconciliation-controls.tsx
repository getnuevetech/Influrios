import { IconCalendarSmall, IconChevronDown, IconDownload, IconRefresh } from "./ledger-icons";

export const asOf = (date: Date) =>
  `As of ${date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })} ${date
    .toISOString()
    .slice(11, 16)} UTC`;

/** Header buttons: re-read provider records, download the reconciliation. */
export function ReconciliationButtons({ currency }: { currency: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={`/admin/contract-ledger?tab=reconciliation&currency=${encodeURIComponent(currency)}&refresh=${Date.now()}`}
        className="inline-flex items-center gap-2 rounded-xl border-2 border-[#6D4AFF] bg-white px-5 py-2 text-[15px] font-semibold text-[#6D4AFF] hover:bg-[#F6F3FF]"
      >
        <IconRefresh /> Refresh records
      </a>
      <a
        href={`/admin/contract-ledger/reconciliation-export?currency=${encodeURIComponent(currency)}`}
        className="inline-flex items-center gap-2 rounded-xl bg-[#6D4AFF] px-6 py-2.5 text-[15px] font-semibold text-white hover:bg-[#5836D6]"
      >
        <IconDownload /> Download reconciliation
      </a>
    </div>
  );
}

/** Selectors shown on the tab row: provider account, currency, and when the records were read. */
export function ReconciliationSelectors({ currency, currencies, readAt }: { currency: string; currencies: string[]; readAt: Date }) {
  const select = "h-10 appearance-none rounded-lg border border-[#D9DCEB] bg-white pl-3 pr-9 text-[13.5px] text-[#1B1464]";
  return (
    <form action="/admin/contract-ledger" className="flex flex-wrap items-center gap-3 pb-1.5">
      <input type="hidden" name="tab" value="reconciliation" />
      <label className="relative">
        <select name="provider" defaultValue="stripe" aria-label="Provider account" className={`${select} w-[220px]`}>
          <option value="stripe">Provider account · Stripe</option>
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <IconChevronDown />
        </span>
      </label>
      <label className="relative">
        <select name="currency" defaultValue={currency} aria-label="Currency" className={`${select} w-[120px]`}>
          {currencies.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
          <IconChevronDown />
        </span>
      </label>
      <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#D9DCEB] bg-white px-3 text-[13.5px] text-[#1B1464]">
        <IconCalendarSmall /> {asOf(readAt)}
        <IconChevronDown />
      </button>
    </form>
  );
}
