"use client";

import { useMemo, useState } from "react";

export type JurisdictionOption = {
  code: string;
  label: string;
  currency: string;
  fundingTerm: string;
};

export type PayoutMethodChoice = {
  countryCode: string;
  method: string;
  label: string;
};

/**
 * Jurisdiction + payout method selects. Payout options come only from the corridor
 * configured for the selected jurisdiction — never a union of every country.
 */
export function JurisdictionPayoutMethodFields({
  jurisdictions,
  payoutChoices,
}: {
  jurisdictions: JurisdictionOption[];
  payoutChoices: PayoutMethodChoice[];
}) {
  const [jurisdictionCode, setJurisdictionCode] = useState("");
  const methodsForJurisdiction = useMemo(() => {
    if (!jurisdictionCode) return [];
    return payoutChoices.filter((choice) => choice.countryCode === jurisdictionCode);
  }, [jurisdictionCode, payoutChoices]);

  return (
    <>
      <label className="text-sm">
        <span className="font-semibold text-indigo">Jurisdiction</span>
        <select
          name="jurisdictionCode"
          className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
          required
          value={jurisdictionCode}
          onChange={(event) => setJurisdictionCode(event.target.value)}
        >
          <option value=""> </option>
          {jurisdictions.map((row) => (
            <option key={row.code} value={row.code}>
              {row.label} · {row.currency} · {row.fundingTerm}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="font-semibold text-indigo">Payout method</span>
        <select
          name="payoutMethod"
          className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
          defaultValue=""
          key={jurisdictionCode || "none"}
        >
          <option value=""> </option>
          {methodsForJurisdiction.map((choice) => (
            <option key={`${choice.countryCode}:${choice.method}`} value={choice.method}>
              {choice.label}
            </option>
          ))}
        </select>
        {jurisdictionCode && methodsForJurisdiction.length === 0 ? (
          <span className="mt-1 block text-[11px] text-muted">
            No payout methods on this jurisdiction’s corridor yet. Add them under Admin → Country corridors.
          </span>
        ) : null}
      </label>
    </>
  );
}
