"use client";

import { useRef } from "react";
import { IconCalendarSmall, IconChevronDown, IconSearchSmall } from "./ledger-icons";

export const DATE_RANGES = [
  { value: "", label: "Date range" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
];

/** Search, currency and date range. Changing a select submits; search submits on Enter. */
export function LedgerFilters({
  tab,
  q,
  currency,
  currencies,
  days,
}: {
  tab: string;
  q: string;
  currency: string;
  currencies: string[];
  days: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const submit = () => form.current?.requestSubmit();
  return (
    <form ref={form} action="/admin/contract-ledger" className="mt-4 flex flex-wrap items-center gap-3">
      <input type="hidden" name="tab" value={tab} />
      <label className="relative min-w-[240px] flex-1">
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[#1B1464]">
          <IconSearchSmall />
        </span>
        <input
          name="q"
          defaultValue={q}
          placeholder="Search contracts (ID, campaign, business or influencer)"
          aria-label="Search contracts"
          className="h-11 w-full rounded-xl border border-[#D9DCEB] bg-white pl-10 pr-3 text-[14px] text-[#1B1464] outline-none placeholder:text-[#4B5070] focus:border-[#6D4AFF]"
        />
      </label>
      <label className="relative">
        <select
          name="currency"
          defaultValue={currency}
          onChange={submit}
          aria-label="Currency"
          className="h-11 w-[130px] appearance-none rounded-xl border border-[#D9DCEB] bg-white pl-3.5 pr-9 text-[14px] text-[#1B1464] outline-none focus:border-[#6D4AFF]"
        >
          {currencies.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[#1B1464]">
          <IconChevronDown />
        </span>
      </label>
      <label className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[#1B1464]">
          <IconCalendarSmall />
        </span>
        <select
          name="days"
          defaultValue={days}
          onChange={submit}
          aria-label="Date range"
          className="h-11 w-[300px] max-w-full appearance-none rounded-xl border border-[#D9DCEB] bg-white pl-10 pr-9 text-[14px] text-[#1B1464] outline-none focus:border-[#6D4AFF]"
        >
          {DATE_RANGES.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[#1B1464]">
          <IconChevronDown />
        </span>
      </label>
    </form>
  );
}
