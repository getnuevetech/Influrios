"use client";

import { Fragment, useRef, useState } from "react";
import { AccountDialog } from "@/components/account-dialog";
import { comparisonGroup, type ComparisonGroup, type ComparisonRow } from "@/lib/plan-presentation";

const GROUPS: ComparisonGroup[] = ["Profile", "Discovery", "Collaboration", "Analytics"];

export function CompareFeatures({
  plans,
  rows,
}: {
  plans: { code: string; name: string }[];
  rows: ComparisonRow[];
}) {
  const [open, setOpen] = useState(false);
  const [differences, setDifferences] = useState(false);
  const [left, setLeft] = useState(plans[0]?.code ?? "");
  const [right, setRight] = useState(plans[1]?.code ?? plans[0]?.code ?? "");
  const scrollY = useRef(0);
  const visible = plans.filter((plan) => plan.code === left || plan.code === right);
  const shown = visible.length >= 2 ? visible : plans.slice(0, 2);

  function cellText(row: ComparisonRow, code: string) {
    const cell = row.cells.find((item) => item.code === code);
    if (!cell || !cell.included) return "Not included";
    return cell.text === "Included" ? "Included" : cell.text;
  }

  function openDialog() {
    scrollY.current = window.scrollY;
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    const y = scrollY.current;
    requestAnimationFrame(() => window.scrollTo(0, y));
  }

  const grouped = GROUPS.map((group) => ({
    group,
    rows: rows.filter((row) => comparisonGroup(row.key) === group).filter((row) => {
      if (!differences) return true;
      const values = shown.map((plan) => cellText(row, plan.code));
      return new Set(values).size > 1;
    }),
  })).filter((group) => group.rows.length > 0);

  return (
    <div className="mt-6 flex justify-center">
      <button type="button" className="btn-secondary !py-2 text-sm" onClick={openDialog}>
        Compare features
      </button>
      {open ? (
        <AccountDialog title="Compare features" onClose={closeDialog} wide>
          <label className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={differences} onChange={(event) => setDifferences(event.target.checked)} />
            Show differences only
          </label>
          <div className="mb-4 grid grid-cols-2 gap-2 md:hidden">
            <label className="text-xs font-semibold text-muted">
              Plan
              <select value={left} onChange={(event) => setLeft(event.target.value)} className="mt-1 w-full rounded-xl border px-2 py-2 text-sm text-indigo">
                {plans.map((plan) => <option key={plan.code} value={plan.code}>{plan.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">
              Plan
              <select value={right} onChange={(event) => setRight(event.target.value)} className="mt-1 w-full rounded-xl border px-2 py-2 text-sm text-indigo">
                {plans.map((plan) => <option key={plan.code} value={plan.code}>{plan.name}</option>)}
              </select>
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Feature</th>
                  {plans.map((plan) => {
                    const onMobile = shown.some((item) => item.code === plan.code);
                    return (
                      <th key={plan.code} className={`px-3 py-2 font-semibold text-indigo ${onMobile ? "" : "hidden md:table-cell"}`}>
                        {plan.name}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {grouped.map((group) => (
                  <Fragment key={group.group}>
                    <tr>
                      <th colSpan={plans.length + 1} className="bg-[#F6F7FB] px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-violet">
                        {group.group}
                      </th>
                    </tr>
                    {group.rows.map((row) => (
                      <tr key={row.key} className="border-t border-[#F0F3FA]">
                        <td className="px-3 py-2 font-medium">{row.label}</td>
                        {plans.map((plan) => {
                          const text = cellText(row, plan.code);
                          const onMobile = shown.some((item) => item.code === plan.code);
                          return (
                            <td key={plan.code} className={`px-3 py-2 ${onMobile ? "" : "hidden md:table-cell"}`}>
                              <span className="sr-only">{text}</span>
                              <span aria-hidden="true">{text === "Included" ? "✓" : text === "Not included" ? "—" : text}</span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="button" className="rounded-full bg-violet px-4 py-2 text-sm font-semibold text-white" onClick={closeDialog}>
              Done
            </button>
          </div>
        </AccountDialog>
      ) : null}
    </div>
  );
}
