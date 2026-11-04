"use client";

import { useMemo, useState } from "react";
import { actionConfirmSpecialties } from "@/app/dashboard/specialty-actions";
import { IconSearch } from "@/components/icons";

type Group = {
  slug: string;
  name: string;
  children: { slug: string; name: string; active?: boolean }[];
};

export function SpecialtyPicker({
  draftId,
  specialtyCap,
  groups,
  selected,
  suggested,
}: {
  draftId: string;
  specialtyCap: number;
  groups: Group[];
  selected: string[];
  suggested: { slug: string; name: string }[];
}) {
  const [q, setQ] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>(selected);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return groups
      .map((group) => {
        const children = group.children.filter((c) => c.active !== false).filter((c) => {
          if (selectedOnly && !picked.includes(c.slug) && group.slug !== picked.find((s) => s === group.slug)) {
            if (!picked.includes(c.slug)) return false;
          }
          if (!query) return true;
          return (
            c.name.toLowerCase().includes(query) ||
            c.slug.includes(query) ||
            group.name.toLowerCase().includes(query)
          );
        });
        const parentMatch =
          !query || group.name.toLowerCase().includes(query) || group.slug.includes(query);
        if (selectedOnly) {
          const keepParent = picked.includes(group.slug);
          const keepChildren = children.filter((c) => picked.includes(c.slug));
          if (!keepParent && keepChildren.length === 0) return null;
          return { ...group, children: keepChildren };
        }
        if (!parentMatch && children.length === 0) return null;
        return { ...group, children };
      })
      .filter(Boolean) as Group[];
  }, [groups, q, selectedOnly, picked]);

  function toggle(slug: string) {
    setPicked((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= specialtyCap) return [...prev.slice(1), slug];
      return [...prev, slug];
    });
  }

  const nameFor = (slug: string) => {
    for (const g of groups) {
      if (g.slug === slug) return g.name;
      const c = g.children.find((x) => x.slug === slug);
      if (c) return c.name;
    }
    return suggested.find((s) => s.slug === slug)?.name || slug;
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {picked.slice(0, 8).map((slug) => (
          <span key={slug} className="rounded-full bg-[#EEE8FF] px-2.5 py-1 text-[11px] font-semibold text-violet">
            {nameFor(slug)}
          </span>
        ))}
        {picked.length > 8 ? (
          <span className="rounded-full bg-[#F3F6FF] px-2.5 py-1 text-[11px] font-semibold text-muted">
            +{picked.length - 8} more
          </span>
        ) : null}
        {picked.length === 0 ? (
          <span className="text-sm text-muted">No specialties selected yet.</span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 rounded-full border border-[#E4EBFF] bg-white px-3 py-1.5 text-[12px] font-semibold text-violet"
      >
        Edit specialties
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-indigo/30 p-3 backdrop-blur-[1px]">
          <div className="flex h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#EEF2FF] px-4 py-3">
              <div>
                <p className="font-display text-lg font-bold text-indigo">Specialties & niches</p>
                <p className="text-[12px] text-muted">
                  {picked.length}/{specialtyCap} selected
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPicked(selected);
                  setOpen(false);
                }}
                className="text-sm font-semibold text-muted hover:text-indigo"
              >
                Close
              </button>
            </div>
            <div className="space-y-2 border-b border-[#EEF2FF] px-4 py-3">
              <label className="relative block">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
                  <IconSearch size={14} />
                </span>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search categories…"
                  className="w-full rounded-full border border-[#E4EBFF] bg-[#F7F9FF] py-2 pl-9 pr-3 text-[13px]"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-indigo">
                  <input
                    type="checkbox"
                    checked={selectedOnly}
                    onChange={(e) => setSelectedOnly(e.target.checked)}
                  />
                  Selected only
                </label>
                <button
                  type="button"
                  onClick={() => setPicked([])}
                  className="text-[12px] font-semibold text-muted hover:text-violet"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setPicked(selected)}
                  className="text-[12px] font-semibold text-muted hover:text-violet"
                >
                  Reset
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {filtered.map((group) => (
                <details key={group.slug} className="mb-2 rounded-xl border border-[#E4EBFF] bg-[#FBFBFF] p-3" open={Boolean(q) || selectedOnly}>
                  <summary className="cursor-pointer list-none font-semibold text-indigo">
                    <label className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={picked.includes(group.slug)}
                        onChange={() => toggle(group.slug)}
                      />
                      {group.name}
                    </label>
                  </summary>
                  <ul className="mt-2 space-y-1.5 pl-2">
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
            <form action={actionConfirmSpecialties} className="border-t border-[#EEF2FF] px-4 py-3">
              <input type="hidden" name="draftId" value={draftId} />
              {picked.map((slug) => (
                <input key={slug} type="hidden" name="specialty" value={slug} />
              ))}
              <button type="submit" className="btn-primary w-full !py-2 text-sm">
                Save changes
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
