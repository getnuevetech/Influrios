"use client";

import { useState } from "react";

type Row = { title: string; shareBps: number };

/**
 * Admin milestone templates stay fixed.
 * Choosing Custom schedule is what unlocks the titles and percents.
 */
export function ContractMilestones({
  templates,
  customEnabled,
  initialCustom,
  initialAccepted,
}: {
  templates: Row[];
  customEnabled: boolean;
  initialCustom: boolean;
  initialAccepted: boolean;
}) {
  const [custom, setCustom] = useState(initialCustom && customEnabled);
  const blanks: Row[] = [
    { title: "", shareBps: 0 },
    { title: "", shareBps: 0 },
    { title: "", shareBps: 0 },
    { title: "", shareBps: 0 },
  ];
  const rows = custom ? blanks : templates;

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <label className="inline-flex items-center gap-2 font-semibold text-indigo">
          <input
            type="radio"
            name="milestoneMode"
            value="template"
            checked={!custom}
            onChange={() => setCustom(false)}
          />
          Admin templates
        </label>
        <label className={`inline-flex items-center gap-2 font-semibold ${customEnabled ? "text-indigo" : "text-muted"}`}>
          <input
            type="radio"
            name="milestoneMode"
            value="custom"
            checked={custom}
            disabled={!customEnabled}
            onChange={() => setCustom(true)}
          />
          Custom schedule{customEnabled ? "" : " (Pro/Agency)"}
        </label>
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-xs text-muted">No milestone templates are saved.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((row, index) => (
            <li key={`${custom ? "custom" : "template"}-${index}`} className="grid grid-cols-[1fr_88px] gap-2">
              <input
                name="milestoneTitle"
                defaultValue={row.title}
                readOnly={!custom}
                aria-label="Milestone title"
                className={`rounded-xl border border-border px-3 py-2 text-sm ${custom ? "" : "bg-[#F4F7FF] text-indigo"}`}
              />
              <input
                name="milestonePercent"
                defaultValue={row.shareBps > 0 ? (row.shareBps / 100).toFixed(0) : ""}
                readOnly={!custom}
                aria-label="Percent"
                className={`rounded-xl border border-border px-3 py-2 text-sm ${custom ? "" : "bg-[#F4F7FF] text-indigo"}`}
              />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted">
        {custom
          ? "Enter the milestone titles and percents. Blank rows are left out. Percents must total 100."
          : "Admin templates are fixed. Choose Custom schedule before changing a milestone."}
      </p>
      {custom ? (
        <label className="mt-4 flex items-start gap-2 text-sm text-indigo">
          <input
            type="checkbox"
            name="influencerAccepted"
            defaultChecked={initialAccepted}
            className="mt-0.5 accent-violet"
          />
          <span>Influencer accepted this custom milestone schedule (required when using custom).</span>
        </label>
      ) : null}
    </>
  );
}
