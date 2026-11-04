"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { actionSaveCreatorOptIn } from "@/app/dashboard/opt-in-actions";
import { IconSearch } from "@/components/icons";
import type { ManagedIntro } from "@/lib/managed-matching";

type Group = {
  slug: string;
  name: string;
  children: { slug: string; name: string; active?: boolean }[];
};

export function ManagedIntrosPanel({
  openToManaged,
  niches,
  targetingNotes,
  updatedAt,
  groups,
  activeIntros,
  historyIntros,
  initialTab = "preferences",
}: {
  openToManaged: boolean;
  niches: string[];
  targetingNotes: string;
  updatedAt?: string | null;
  groups: Group[];
  activeIntros: ManagedIntro[];
  historyIntros: ManagedIntro[];
  initialTab?: "preferences" | "active" | "history";
}) {
  const [tab, setTab] = useState(initialTab);
  const [q, setQ] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [picked, setPicked] = useState<string[]>(niches);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return groups
      .map((group) => {
        const children = group.children.filter((c) => c.active !== false).filter((c) => {
          if (selectedOnly && !picked.includes(c.slug)) return false;
          if (!query) return true;
          return c.name.toLowerCase().includes(query) || group.name.toLowerCase().includes(query);
        });
        if (selectedOnly && !picked.includes(group.slug) && children.length === 0) return null;
        if (query && !group.name.toLowerCase().includes(query) && children.length === 0) return null;
        return { ...group, children };
      })
      .filter(Boolean) as Group[];
  }, [groups, q, selectedOnly, picked]);

  function toggle(slug: string) {
    setPicked((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-full bg-[#F3F6FF] p-1 w-fit">
        {(
          [
            ["preferences", "Preferences"],
            ["active", `Active Introductions (${activeIntros.length})`],
            ["history", `History (${historyIntros.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              tab === id ? "bg-white text-violet shadow-sm" : "text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "preferences" ? (
        <form action={actionSaveCreatorOptIn} className="space-y-4 rounded-2xl border border-[#E4EBFF] bg-white p-5">
          <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
            <input
              type="checkbox"
              name="openToManaged"
              defaultChecked={openToManaged}
              className="accent-violet"
            />
            Open to managed introductions
          </label>
          <p className="text-[12px] text-muted">
            {updatedAt ? `Last updated ${new Date(updatedAt).toLocaleString()}. ` : null}
            Selected categories: {picked.length}
          </p>
          <div className="space-y-2">
            <label className="relative block">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
                <IconSearch size={14} />
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search target categories…"
                className="w-full rounded-full border border-[#E4EBFF] bg-[#F7F9FF] py-2 pl-9 pr-3 text-[13px]"
              />
            </label>
            <div className="flex flex-wrap gap-2 text-[12px] font-semibold">
              <label className="inline-flex items-center gap-1.5 text-indigo">
                <input type="checkbox" checked={selectedOnly} onChange={(e) => setSelectedOnly(e.target.checked)} />
                Selected only
              </label>
              <button type="button" onClick={() => setPicked([])} className="text-muted hover:text-violet">
                Clear
              </button>
              <button type="button" onClick={() => setPicked(niches)} className="text-muted hover:text-violet">
                Reset
              </button>
            </div>
          </div>
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {filtered.map((group) => (
              <details key={group.slug} className="rounded-xl border border-[#E4EBFF] bg-[#FBFBFF] p-3" open={Boolean(q) || selectedOnly}>
                <summary className="cursor-pointer font-semibold text-indigo">
                  <label className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={picked.includes(group.slug)}
                      onChange={() => toggle(group.slug)}
                    />
                    {group.name}
                  </label>
                </summary>
                <ul className="mt-2 space-y-1 pl-2">
                  {group.children.map((child) => (
                    <li key={child.slug}>
                      <label className="flex items-center gap-2 text-sm text-indigo">
                        <input
                          type="checkbox"
                          checked={picked.includes(child.slug)}
                          onChange={() => toggle(child.slug)}
                        />
                        {child.name}
                      </label>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
          {picked.map((slug) => (
            <input key={`persist-${slug}`} type="hidden" name="niche" value={slug} />
          ))}
          <label className="block text-sm">
            <span className="font-semibold text-indigo">Targeting notes</span>
            <textarea
              name="targetingNotes"
              rows={3}
              defaultValue={targetingNotes}
              className="mt-1 w-full rounded-xl border border-border px-3 py-2"
            />
          </label>
          <button type="submit" className="btn-primary !py-2 text-sm">
            Save introduction preferences
          </button>
        </form>
      ) : null}

      {tab === "active" ? (
        <IntroList
          rows={activeIntros}
          empty="No active introductions yet. When brands are introduced, they appear here."
        />
      ) : null}
      {tab === "history" ? (
        <IntroList rows={historyIntros} empty="No closed or declined introductions yet." />
      ) : null}
    </div>
  );
}

function IntroList({ rows, empty }: { rows: ManagedIntro[]; empty: string }) {
  if (!rows.length) {
    return <p className="rounded-2xl border border-dashed border-[#E4EBFF] bg-white p-6 text-sm text-muted">{empty}</p>;
  }
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.id} className="rounded-2xl border border-[#E4EBFF] bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-indigo">{row.briefTitle}</p>
              <p className="text-[12px] text-muted">{row.businessName}</p>
            </div>
            <span className="rounded-full bg-[#EEE8FF] px-2 py-0.5 text-[11px] font-semibold text-violet">
              {row.status}
            </span>
          </div>
          {row.notes ? <p className="mt-2 text-sm text-muted">{row.notes}</p> : null}
          <p className="mt-2 text-[11px] text-muted">Updated {new Date(row.updatedAt).toLocaleString()}</p>
          <Link href="/collaboration/hub" className="mt-2 inline-block text-[12px] font-semibold text-violet">
            Open collaborations →
          </Link>
        </li>
      ))}
    </ul>
  );
}
