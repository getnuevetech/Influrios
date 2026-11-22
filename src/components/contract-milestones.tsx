"use client";

import { useState } from "react";

type Row = { title: string; shareBps: number };

/**
 * The business sets the agreement's milestones. The full budget is funded up front and released
 * milestone by milestone; each milestone's share also sets that release's platform fee.
 * Starts with one milestone for 100%. Add, rename, split or remove; shares must total 100%.
 */
export function ContractMilestones({ initial, max }: { initial: Row[]; max: number }) {
  const start = initial.length ? initial : [{ title: "Delivery", shareBps: 10_000 }];
  const [rows, setRows] = useState(start.map((row) => ({ title: row.title, percent: row.shareBps > 0 ? String(row.shareBps / 100) : "" })));
  const total = rows.reduce((sum, row) => sum + (Number(row.percent) || 0), 0);
  const update = (index: number, patch: Partial<{ title: string; percent: string }>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const add = () =>
    setRows((current) => {
      if (current.length >= max) return current;
      // Split the last milestone so the total stays at 100% where possible.
      const last = Number(current[current.length - 1]?.percent) || 0;
      const half = Math.floor(last / 2);
      const next = current.map((row, i) => (i === current.length - 1 && half >= 5 ? { ...row, percent: String(last - half) } : row));
      return [...next, { title: "", percent: half >= 5 ? String(half) : "" }];
    });
  const remove = (index: number) =>
    setRows((current) => {
      if (current.length <= 1) return current;
      const removed = Number(current[index]?.percent) || 0;
      const next = current.filter((_, i) => i !== index);
      // Give the removed share to the previous milestone (or the new first one).
      const target = Math.max(0, index - 1);
      return next.map((row, i) => (i === target ? { ...row, percent: String((Number(row.percent) || 0) + removed) } : row));
    });

  return (
    <>
      <input type="hidden" name="milestoneMode" value="custom" />
      <ul className="mt-4 space-y-2">
        {rows.map((row, index) => (
          <li key={index} className="grid grid-cols-[1fr_96px_auto] items-center gap-2">
            <input
              name="milestoneTitle"
              value={row.title}
              onChange={(event) => update(index, { title: event.target.value })}
              placeholder={index === 0 ? "e.g. Final video delivered" : "Milestone name"}
              aria-label={`Milestone ${index + 1} name`}
              required
              className="rounded-xl border border-border px-3 py-2 text-sm"
            />
            <span className="flex items-center gap-1">
              <input
                name="milestonePercent"
                value={row.percent}
                onChange={(event) => update(index, { percent: event.target.value.replace(/[^0-9.]/g, "") })}
                inputMode="decimal"
                aria-label={`Milestone ${index + 1} share, percent`}
                className="w-full rounded-xl border border-border px-3 py-2 text-sm"
              />
              <span className="text-sm text-muted">%</span>
            </span>
            {rows.length > 1 ? (
              <button type="button" onClick={() => remove(index)} className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted">
                Remove
              </button>
            ) : (
              <span />
            )}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <button
          type="button"
          onClick={add}
          disabled={rows.length >= max}
          className="rounded-full border border-violet/40 px-3 py-1.5 text-xs font-bold text-violet disabled:opacity-50"
        >
          + Add milestone
        </button>
        <span className={`text-xs font-semibold ${Math.round(total * 100) === 10_000 ? "text-emerald-700" : "text-amber-800"}`} aria-live="polite">
          Total {total}%{Math.round(total * 100) === 10_000 ? "" : " · must add up to 100%"}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted">
        The full budget is funded up front. Each milestone is released to the influencer when its work is approved, and its share
        sets that release&apos;s platform fee. One milestone pays everything at the end; up to {max} milestones. With several
        milestones, each is between 5% and 90%. The influencer agrees to these milestones by signing the agreement.
      </p>
    </>
  );
}
