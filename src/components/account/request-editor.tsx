"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { actionWorkspaceRequest } from "@/app/collaboration/business/actions";

export type EditorCreator = {
  slug: string;
  name: string;
  handle: string;
  country: string;
  specialties: string;
};

export function RequestEditor(props: {
  briefId: string;
  locked: boolean;
  error?: string;
  saved?: string;
  title: string;
  goal: string;
  deliverables: string;
  budget: string;
  currency: string;
  currencies: string[];
  deadline: string;
  locationCountry: string;
  specialties: { slug: string; name: string }[];
  specialty: string;
  platforms: string[];
  platform: string;
  creators: EditorCreator[];
  initialSlugs: string[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(props.initialSlugs);
  const [mode, setMode] = useState<"private" | "public">(props.initialSlugs.length > 0 ? "private" : "public");
  const chosen = props.creators.filter((creator) => selected.includes(creator.slug));
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return props.creators
      .filter((creator) => !selected.includes(creator.slug))
      .filter((creator) => {
        if (!q) return true;
        return `${creator.name} ${creator.handle} ${creator.specialties} ${creator.country}`.toLowerCase().includes(q);
      })
      .slice(0, 6);
  }, [props.creators, query, selected]);

  if (props.locked) {
    return (
      <div className="rounded-2xl border border-[#E6ECF7] bg-white p-6">
        <p className="text-sm font-semibold text-indigo">This request is locked by an agreement.</p>
        <Link href="/collaboration/contracts" className="mt-3 inline-block text-sm font-bold text-violet">
          Open agreements
        </Link>
      </div>
    );
  }

  return (
    <form action={actionWorkspaceRequest} className="rounded-2xl border border-[#E6ECF7] bg-white p-5 sm:p-6">
      {props.briefId ? <input type="hidden" name="briefId" value={props.briefId} /> : null}
      {selected.map((slug) => (
        <input key={slug} type="hidden" name="creatorSlug" value={slug} />
      ))}
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-display text-2xl font-bold text-[#1B1464]">Create request</h2>
      </div>
      {props.error ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{props.error}</p> : null}
      {props.saved === "draft" ? <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Draft saved. Nothing was sent.</p> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-indigo">
          Campaign title *
          <input name="title" required defaultValue={props.title} className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-semibold text-indigo">
          Gross influencer compensation *
          <span className="mt-1 flex gap-2">
            <input name="budget" inputMode="decimal" defaultValue={props.budget} placeholder="1,000" className="w-full rounded-xl border border-[#E4E9F5] px-3 py-2 font-normal" />
            <select name="budgetCurrency" defaultValue={props.currency} className="rounded-xl border border-[#E4E9F5] px-2 py-2 font-normal">
              {props.currencies.map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </span>
        </label>
        <label className="text-sm font-semibold text-indigo sm:col-span-2">
          Objective *
          <textarea name="goal" rows={2} defaultValue={props.goal} className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-semibold text-indigo sm:col-span-2">
          Deliverables *
          <textarea name="deliverables" rows={3} defaultValue={props.deliverables} className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-semibold text-indigo">
          Specialty
          <select name="specialty" defaultValue={props.specialty} className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-2 font-normal">
            <option value="">Any specialty</option>
            {props.specialties.map((item) => (
              <option key={item.slug} value={item.slug}>{item.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-indigo">
          Platform
          <select name="platform" defaultValue={props.platform} className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-2 font-normal">
            <option value="">Any platform</option>
            {props.platforms.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-indigo">
          Market
          <input name="locationCountry" defaultValue={props.locationCountry} placeholder="Country or market" className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-semibold text-indigo">
          Deadline *
          <input name="responseDeadline" type="date" defaultValue={props.deadline} className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-2 font-normal" />
        </label>
      </div>
      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-indigo">Invite influencers</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {chosen.map((creator) => (
            <button
              key={creator.slug}
              type="button"
              onClick={() => setSelected((current) => current.filter((slug) => slug !== creator.slug))}
              className="rounded-full bg-[#F1ECFF] px-3 py-1 text-xs font-semibold text-violet"
            >
              {creator.name} @{creator.handle} ×
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search influencers by name or handle"
          className="mt-3 w-full rounded-xl border border-[#E4E9F5] px-3 py-2 text-sm"
        />
        <ul className="mt-2 divide-y divide-[#F0F3FA]">
          {results.map((creator) => (
            <li key={creator.slug} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>
                <span className="font-semibold text-indigo">{creator.name}</span>
                <span className="text-[#667085]"> @{creator.handle} · {creator.country}</span>
              </span>
              <button
                type="button"
                onClick={() => setSelected((current) => [...current, creator.slug])}
                className="rounded-full border border-violet px-3 py-1 text-xs font-bold text-violet"
              >
                Add influencer
              </button>
            </li>
          ))}
        </ul>
      </fieldset>
      <fieldset className="mt-4 space-y-2 text-sm">
        <label className="flex items-start gap-2">
          <input type="radio" name="distribution" checked={mode === "private"} onChange={() => setMode("private")} />
          <span><span className="font-semibold text-indigo">Private invite</span><span className="block text-xs text-[#667085]">Invite specific influencers. This does not publish the request.</span></span>
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" name="distribution" checked={mode === "public"} onChange={() => setMode("public")} />
          <span><span className="font-semibold text-indigo">Public listing</span><span className="block text-xs text-[#667085]">Eligible influencers can apply. Private invites are a separate action.</span></span>
        </label>
      </fieldset>
      <div className="sticky bottom-0 mt-6 flex flex-wrap justify-end gap-2 border-t border-[#E6ECF7] bg-white py-3">
        <button type="submit" name="submitIntent" value="draft" className="rounded-full border border-[#E4E9F5] px-4 py-2 text-sm font-bold text-indigo">
          Save draft
        </button>
        {mode === "private" ? (
          <button type="submit" name="submitIntent" value="invite" className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-bold text-white">
            Send {selected.length === 1 ? "1 invitation" : `${selected.length} invitations`}
          </button>
        ) : (
          <button type="submit" name="submitIntent" value="publish" className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-bold text-white">
            Publish listing
          </button>
        )}
      </div>
    </form>
  );
}
