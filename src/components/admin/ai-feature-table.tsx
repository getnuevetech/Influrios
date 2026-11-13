"use client";

import { useState } from "react";
import { actionAssignAiFunction } from "@/app/admin/ai/actions";

type Feature = {
  key: string;
  label: string;
  description: string;
  fallback: string;
  providerId: string;
  enabled: boolean;
  mode: string;
};

type Provider = { id: string; name: string; code: string; model: string };

export function AiFeatureTable({
  features,
  providers,
  canEdit,
}: {
  features: Feature[];
  providers: Provider[];
  canEdit: boolean;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const feature = features.find((row) => row.key === openKey) ?? null;
  const provider = providers.find((row) => row.id === feature?.providerId);

  return (
    <section className="mt-6">
      <h2 className="font-display text-lg font-bold text-indigo">AI and automation</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Each feature is independent. Generated text stays a draft until a person applies it. These controls do not approve work, change fees, or send invitations.
      </p>
      <div className="mt-4 overflow-hidden rounded-2xl border border-[#E4EBFF] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F7F9FF] text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Feature</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Details</th>
              <th className="px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {features.map((row) => (
              <tr key={row.key} className="border-t border-[#EEF2FF]">
                <td className="px-4 py-3 font-semibold text-indigo">{row.label}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${row.enabled ? "bg-emerald-50 text-emerald-700" : "bg-[#F4F6FB] text-[#667085]"}`}>
                    {row.enabled ? "On" : "Off"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted">{row.mode === "provider" ? "Assigned provider" : `Manual fallback: ${row.fallback}`}</td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => setOpenKey(row.key)} className="rounded-full border border-[#E4EBFF] px-3 py-1.5 text-xs font-semibold text-violet">
                    Configure
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {feature ? (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="Close AI settings" className="absolute inset-0 bg-[#1B1464]/40" onClick={() => setOpenKey(null)} />
          <div role="dialog" aria-modal="true" className="absolute left-1/2 top-1/2 w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-xl font-bold text-indigo">{feature.label}</h3>
                <p className="mt-1 text-sm text-muted">{feature.description}</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setOpenKey(null)} className="text-xl text-[#667085]">×</button>
            </div>
            <form action={actionAssignAiFunction} className="mt-4 space-y-3">
              <input type="hidden" name="functionKey" value={feature.key} />
              <label className="block text-sm font-semibold text-indigo">
                Approved provider
                <select name="providerId" defaultValue={feature.providerId} disabled={!canEdit} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal">
                  <option value="">Manual fallback</option>
                  {providers.map((row) => (
                    <option key={row.id} value={row.id}>{row.name} ({row.code})</option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-muted">Model identifier: {provider?.model || "Not assigned. A blank model stays on the manual fallback."}</p>
              <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
                <input type="checkbox" name="enabled" value="1" defaultChecked={feature.enabled} disabled={!canEdit} />
                Feature on
              </label>
              <p className="text-xs text-muted">Turning a feature on does not publish suggestions or move money.</p>
              {canEdit ? <button type="submit" className="rounded-full bg-violet px-4 py-2 text-sm font-semibold text-white">Save</button> : null}
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
