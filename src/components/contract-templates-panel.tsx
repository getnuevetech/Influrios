"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CONTRACT_DOCUMENT_TYPES } from "@/lib/contract-catalog";

export function ContractTemplatesPanel({
  aiEnabled,
  workspaceTemplates = [],
}: {
  aiEnabled: boolean;
  workspaceTemplates?: { id: string; name: string; description: string; typeLabel: string; versionLabel: string }[];
}) {
  const [q, setQ] = useState("");
  const platform = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CONTRACT_DOCUMENT_TYPES.filter((row) => {
      if (!needle) return true;
      return `${row.name} ${row.description} ${row.typeLabel}`.toLowerCase().includes(needle);
    });
  }, [q]);

  return (
    <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5">
      <div>
        <h2 className="font-display text-lg font-bold text-[#1B1464]">Templates · Select a document type</h2>
        <p className="mt-1 text-sm text-[#667085]">Start from a reusable template and customize it for your collaboration.</p>
      </div>
      <label className="mt-4 flex h-11 items-center gap-2 rounded-full border border-[#E7ECF5] bg-[#F8FAFC] px-4 text-sm text-[#667085]">
        <span aria-hidden>⌕</span>
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search templates (e.g., 'NDA', 'statement of work')"
          className="w-full bg-transparent outline-none"
        />
      </label>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">
            <tr className="border-b border-[#EEF2F7]">
              <th className="py-2 font-semibold">Template</th>
              <th className="font-semibold">Description</th>
              <th className="font-semibold">Type</th>
              <th className="font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {platform.map((row) => (
              <tr key={row.id} className="border-b border-[#F2F4F8]">
                <td className="py-4 pr-3">
                  <p className="font-semibold text-[#1B1464]">{row.name}</p>
                  <p className="mt-1 text-xs text-[#98A2B3]">Published {row.version}</p>
                </td>
                <td className="max-w-sm text-[#667085]">{row.description}</td>
                <td>
                  <span className="rounded-full bg-[#F3EEFF] px-2.5 py-1 text-[11px] font-semibold text-[#6D4AFF]">{row.typeLabel}</span>
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/collaboration/contracts?view=templates&use=${row.id}&step=parties`}
                      className="rounded-full bg-[#6D4AFF] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Use template
                    </Link>
                    <Link
                      href={`/collaboration/contracts?view=templates&customize=${row.id}`}
                      className="rounded-full border border-[#E7ECF5] px-3 py-1.5 text-xs font-semibold text-[#344054]"
                    >
                      Customize template
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {workspaceTemplates.map((row) => (
              <tr key={row.id} className="border-b border-[#F2F4F8]">
                <td className="py-4 pr-3">
                  <p className="font-semibold text-[#1B1464]">{row.name}</p>
                  <p className="mt-1 text-xs text-[#98A2B3]">Workspace · {row.versionLabel}</p>
                </td>
                <td className="max-w-sm text-[#667085]">{row.description}</td>
                <td>
                  <span className="rounded-full bg-[#EEF3FF] px-2.5 py-1 text-[11px] font-semibold text-[#2F6BFF]">{row.typeLabel}</span>
                </td>
                <td>
                  <Link
                    href={`/collaboration/contracts?view=templates&use=${row.id}&step=parties`}
                    className="rounded-full bg-[#6D4AFF] px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Use template
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!aiEnabled ? (
        <p className="mt-4 rounded-2xl border border-[#E7ECF5] bg-[#F8FAFC] px-4 py-3 text-sm text-[#667085]">
          AI wording suggestions are off. You can still choose a template, fill required fields, edit permitted clauses manually, preview, and send.
        </p>
      ) : (
        <p className="mt-4 text-sm text-[#667085]">
          After Confirm parties, use <span className="font-semibold text-[#1B1464]">Tailor this draft with AI</span> on editable clauses, or{" "}
          <span className="font-semibold text-[#1B1464]">Save as reusable template</span> with sample parties before publishing a workspace copy.
        </p>
      )}
    </section>
  );
}
