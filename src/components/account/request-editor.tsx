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

const STEPS = ["Brief", "Audience", "Terms", "Review"] as const;

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
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(props.initialSlugs);
  const [mode, setMode] = useState<"private" | "public">(props.initialSlugs.length > 0 ? "private" : "public");
  const [title, setTitle] = useState(props.title);
  const [goal, setGoal] = useState(props.goal);
  const [deliverables, setDeliverables] = useState(props.deliverables);
  const [specialty, setSpecialty] = useState(props.specialty);
  const [budget, setBudget] = useState(props.budget);
  const [deadline, setDeadline] = useState(props.deadline);
  const [block, setBlock] = useState("");
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

  function next() {
    if (step === 0 && (!title.trim() || !goal.trim() || !deliverables.trim())) {
      setBlock("Add a title, objective, and deliverables before continuing.");
      return;
    }
    if (step === 1 && mode === "private" && selected.length === 0) {
      setBlock("Choose at least one influencer for a private invitation.");
      return;
    }
    if (step === 2 && (!budget.trim() || !deadline)) {
      setBlock("Add the proposed gross and a response deadline.");
      return;
    }
    setBlock("");
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  }

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
    <form action={actionWorkspaceRequest} className="rounded-[28px] border border-[#E6ECF7] bg-white p-5 shadow-sm sm:p-6">
      {props.briefId ? <input type="hidden" name="briefId" value={props.briefId} /> : null}
      {selected.map((slug) => (
        <input key={slug} type="hidden" name="creatorSlug" value={slug} />
      ))}
      <input type="hidden" name="distribution" value={mode} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#1B1464]">Create request</h2>
          <p className="mt-1 text-sm text-[#667085]">One brief. Private invitations or a public opportunity. Saving a draft does not send anything.</p>
        </div>
      </div>
      <ol className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => setStep(index)}
              className={`rounded-full px-3 py-1 ${index === step ? "bg-[#F3EEFF] text-[#6D4AFF]" : "text-[#98A2B3]"}`}
            >
              {index + 1} {label}
            </button>
          </li>
        ))}
      </ol>
      {props.error ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{props.error}</p> : null}
      {props.saved === "draft" ? <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Draft saved. Nothing was sent.</p> : null}
      {block ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{block}</p> : null}

      <div className={step === 0 ? "mt-4 grid gap-4" : "hidden"}>
        <label className="text-sm font-semibold text-indigo">
          Campaign title
          <input name="title" value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-semibold text-indigo">
          Objective
          <textarea name="goal" rows={3} value={goal} onChange={(event) => setGoal(event.target.value)} className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-semibold text-indigo">
          Deliverables
          <textarea name="deliverables" rows={3} value={deliverables} onChange={(event) => setDeliverables(event.target.value)} className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-2 font-normal" />
        </label>
        <label className="text-sm font-semibold text-indigo">
          Specialty
          <select name="specialty" value={specialty} onChange={(event) => setSpecialty(event.target.value)} className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-2 font-normal">
            <option value="">Any specialty</option>
            {props.specialties.map((item) => (
              <option key={item.slug} value={item.slug}>{item.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className={step === 1 ? "mt-4 space-y-4" : "hidden"}>
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <label className={`rounded-2xl border p-4 text-sm ${mode === "private" ? "border-[#6D4AFF] bg-[#F8F6FF]" : "border-[#E4E9F5]"}`}>
            <input type="radio" checked={mode === "private"} onChange={() => setMode("private")} className="accent-[#6D4AFF]" />
            <span className="ml-2 font-semibold text-indigo">Private invitations</span>
            <span className="mt-1 block text-xs text-[#667085]">Invite specific influencers only. Each person sees only their invitation.</span>
          </label>
          <label className={`rounded-2xl border p-4 text-sm ${mode === "public" ? "border-[#6D4AFF] bg-[#F8F6FF]" : "border-[#E4E9F5]"}`}>
            <input type="radio" checked={mode === "public"} onChange={() => setMode("public")} className="accent-[#6D4AFF]" />
            <span className="ml-2 font-semibold text-indigo">Public opportunity</span>
            <span className="mt-1 block text-xs text-[#667085]">Open it so eligible influencers can apply. The final quote follows selection.</span>
          </label>
        </fieldset>
        <div>
          <p className="text-sm font-semibold text-indigo">Selected ({chosen.length})</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {chosen.map((creator) => (
              <button
                key={creator.slug}
                type="button"
                onClick={() => setSelected((current) => current.filter((slug) => slug !== creator.slug))}
                className="rounded-full bg-[#F1ECFF] px-3 py-1 text-xs font-semibold text-violet"
              >
                {creator.name} ×
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search influencers by name, handle, or niche"
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
                  Add
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={step === 2 ? "mt-4 grid gap-4 sm:grid-cols-2" : "hidden"}>
        <label className="text-sm font-semibold text-indigo sm:col-span-2">
          {mode === "public" ? "Public budget (estimate)" : "Proposed gross per influencer"}
          <span className="mt-1 flex gap-2">
            <input name="budget" inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="1,000" className="w-full rounded-xl border border-[#E4E9F5] px-3 py-2 font-normal" />
            <select name="budgetCurrency" defaultValue={props.currency} className="rounded-xl border border-[#E4E9F5] px-2 py-2 font-normal">
              {props.currencies.map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </span>
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
          Respond by
          <input name="responseDeadline" type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-2 font-normal" />
        </label>
      </div>

      <div className={step === 3 ? "mt-4 space-y-3 text-sm" : "hidden"}>
        <dl className="divide-y divide-[#EEF2F7] rounded-2xl border border-[#E7ECF5]">
          <div className="flex justify-between gap-3 px-4 py-3"><dt className="text-[#667085]">Brief</dt><dd className="font-semibold text-[#1B1464]">{title || "Untitled"}</dd></div>
          <div className="flex justify-between gap-3 px-4 py-3"><dt className="text-[#667085]">Visibility</dt><dd className="font-semibold text-[#1B1464]">{mode === "private" ? "Private invitations" : "Public opportunity"}</dd></div>
          <div className="flex justify-between gap-3 px-4 py-3"><dt className="text-[#667085]">Recipients</dt><dd className="text-right font-semibold text-[#1B1464]">{chosen.length ? chosen.map((creator) => creator.name).join(", ") : "Open applications"}</dd></div>
          <div className="flex justify-between gap-3 px-4 py-3"><dt className="text-[#667085]">Estimate</dt><dd className="font-semibold text-[#1B1464]">{budget ? `${props.currency} ${budget}` : "Not set"}</dd></div>
          <div className="flex justify-between gap-3 px-4 py-3"><dt className="text-[#667085]">Respond by</dt><dd className="font-semibold text-[#1B1464]">{deadline || "Not set"}</dd></div>
        </dl>
        <p className="text-xs text-[#98A2B3]">Costs shown here are estimates. Sending creates one invitation per recipient and does not sign a contract.</p>
      </div>

      <div className="sticky bottom-0 mt-6 flex flex-wrap justify-end gap-2 border-t border-[#E6ECF7] bg-white py-3">
        {step > 0 ? (
          <button type="button" onClick={() => setStep((current) => current - 1)} className="rounded-full border border-[#E4E9F5] px-4 py-2 text-sm font-bold text-indigo">
            Back
          </button>
        ) : null}
        <button type="submit" name="submitIntent" value="draft" className="rounded-full border border-[#E4E9F5] px-4 py-2 text-sm font-bold text-indigo">
          Save draft
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={next} className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-bold text-white">
            Next
          </button>
        ) : mode === "private" ? (
          <button
            type="submit"
            name="submitIntent"
            value="invite"
            disabled={selected.length === 0}
            className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            Send invitations
          </button>
        ) : (
          <button type="submit" name="submitIntent" value="publish" className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-bold text-white">
            Publish request
          </button>
        )}
      </div>
    </form>
  );
}
