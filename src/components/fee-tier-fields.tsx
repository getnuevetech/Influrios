"use client";

import { useState } from "react";

type TierRow = { upToUsd: string; percentBps: string };

/** Tier limits and percents for a fee rule. The saved rule stores these fields, not JSON. */
export function FeeTierFields({
  bands,
  disabled,
}: {
  bands: TierRow[];
  disabled?: boolean;
}) {
  const [rows, setRows] = useState<TierRow[]>(bands.length ? bands : [{ upToUsd: "", percentBps: "" }]);

  return (
    <fieldset className="sm:col-span-3" disabled={disabled}>
      <legend className="text-xs font-semibold text-muted">Tier bands</legend>
      <p className="mt-1 text-xs font-normal text-muted">
        Used when the method is Tiered. Up to is the gross in dollars. Leave Up to blank for the remaining amount.
        Percent uses basis points, the same unit as Percent (bps).
      </p>
      <div className="mt-2 space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted">
              Up to USD
              <input
                name="tierUpToUsd"
                defaultValue={row.upToUsd}
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo disabled:bg-[#F3F4F6]"
              />
            </label>
            <label className="text-xs font-semibold text-muted">
              Percent (bps)
              <input
                name="tierPercentBps"
                defaultValue={row.percentBps}
                inputMode="numeric"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo disabled:bg-[#F3F4F6]"
              />
            </label>
          </div>
        ))}
      </div>
      {disabled ? null : (
        <button
          type="button"
          className="mt-2 text-xs font-semibold text-violet"
          onClick={() => setRows((current) => [...current, { upToUsd: "", percentBps: "" }])}
        >
          Add tier
        </button>
      )}
    </fieldset>
  );
}
