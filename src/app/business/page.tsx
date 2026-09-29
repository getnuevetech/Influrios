import Image from "next/image";
import Link from "next/link";
import {
  getWorkspace,
  rankCreatorsForBrief,
} from "@/lib/business";
import {
  BUSINESS_PLAN_PRICES,
  getBusinessEntitlements,
  type BusinessPlanCode,
} from "@/lib/business-entitlements";
import { getCreatorBySlug, SPECIALTY_TAXONOMY, specialtyLabel } from "@/lib/seed-data";
import {
  actionAddShortlist,
  actionCreateBrief,
  actionRemoveShortlist,
  actionSendInquiry,
  actionSetPlan,
} from "./actions";

export const metadata = {
  title: "Business Workspace",
};

type Props = {
  searchParams: Promise<{
    error?: string;
    added?: string;
    brief?: string;
    inquiry?: string;
    plan?: string;
  }>;
};

export default async function BusinessWorkspacePage({ searchParams }: Props) {
  const params = await searchParams;
  const ws = await getWorkspace();
  const entitlements = getBusinessEntitlements(ws.plan);
  const activeBrief = ws.briefs[0];
  const ranked = activeBrief && entitlements.fitInsights ? rankCreatorsForBrief(activeBrief).slice(0, 5) : [];

  return (
    <div className="bg-[#F7FAFF]">
      <section className="hero-atmosphere text-white">
        <div className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lavender/80">
            Phase 3 · Business Pro
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold">Business Workspace</h1>
          <p className="mt-3 max-w-2xl text-white/75">
            Shortlists, campaign briefs, fit explanations, and inquiry limits — precision workflow
            brands will pay for.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-white/15 px-3 py-1 font-semibold">
              {ws.name} · {ws.industry}
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 font-semibold">
              Plan: {BUSINESS_PLAN_PRICES[ws.plan].label}
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[90rem] space-y-6 px-4 py-8 sm:px-6">
        {params.error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {params.error}
          </div>
        ) : null}
        {params.added ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Added to shortlist: {params.added}
          </div>
        ) : null}
        {params.inquiry ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Inquiry sent (demo stored in workspace).
          </div>
        ) : null}

        {/* Plan switcher (demo — Stripe checkout on /billing) */}
        <section id="pricing" className="card-surface p-6">
          <h2 className="font-display text-xl font-bold text-indigo">Business plans</h2>
          <p className="mt-1 text-sm text-muted">
            Switch the demo workspace plan below, or run Phase 6 checkout at{" "}
            <Link href="/billing" className="font-semibold text-violet hover:underline">
              /billing
            </Link>{" "}
            (Stripe when keys are set).
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {(Object.keys(BUSINESS_PLAN_PRICES) as BusinessPlanCode[]).map((code) => {
              const price = BUSINESS_PLAN_PRICES[code];
              const e = getBusinessEntitlements(code);
              const active = ws.plan === code;
              return (
                <form key={code} action={actionSetPlan} className={`rounded-2xl border p-5 ${active ? "border-violet bg-lavender/40" : "border-border"}`}>
                  <input type="hidden" name="plan" value={code} />
                  <p className="text-xs font-bold uppercase tracking-wide text-violet">{price.label}</p>
                  <p className="mt-1 font-display text-2xl font-bold text-indigo">
                    {price.price}
                    <span className="text-sm font-medium text-muted">{price.period}</span>
                  </p>
                  <ul className="mt-3 space-y-1 text-xs text-muted">
                    <li>✓ Shortlist up to {e.shortlistMax}</li>
                    <li>✓ {e.inquiryMaxPerMonth} inquiries / month</li>
                    <li>{e.fitInsights ? "✓" : "–"} Fit insights</li>
                    <li>{e.advancedFilters ? "✓" : "–"} Advanced filters</li>
                    <li>{e.intelligence ? "✓" : "–"} Intelligence</li>
                    <li>{e.agencyWorkspace ? "✓" : "–"} Agency workspace</li>
                    <li>{e.exports ? "✓" : "–"} Exports</li>
                  </ul>
                  <button type="submit" className={`mt-4 w-full !py-2 text-sm ${active ? "btn-secondary" : "btn-primary"}`}>
                    {active ? "Current plan" : "Use this plan"}
                  </button>
                  {code === "AGENCY" ? (
                    <Link href="/agency" className="mt-2 block text-center text-xs font-semibold text-violet hover:underline">
                      Open agency workspace →
                    </Link>
                  ) : null}
                </form>
              );
            })}
          </div>
        </section>

        {/* Phase 5 Intelligence entry */}
        <section className="card-surface flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Phase 5</p>
            <h2 className="mt-1 font-display text-xl font-bold text-indigo">Intelligence</h2>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Audience snapshots, niche trends, relationship signals, and CSV/JSON exports
              {entitlements.intelligence ? " — included on your plan." : " — upgrade to Business Pro to unlock."}
            </p>
          </div>
          <Link
            href="/business/intelligence"
            className={entitlements.intelligence ? "btn-primary" : "btn-secondary"}
          >
            {entitlements.intelligence ? "Open Intelligence →" : "Preview / unlock →"}
          </Link>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          {/* Shortlist */}
          <section className="card-surface p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold text-indigo">Shortlist</h2>
              <span className="text-xs font-semibold text-muted">
                {ws.shortlist.length} / {entitlements.shortlistMax}
              </span>
            </div>
            <ul className="mt-4 space-y-3">
              {ws.shortlist.length === 0 ? (
                <li className="text-sm text-muted">
                  Empty — add creators from{" "}
                  <Link href="/discover" className="font-semibold text-violet">
                    Discover
                  </Link>
                  .
                </li>
              ) : (
                ws.shortlist.map((item) => {
                  const c = getCreatorBySlug(item.creatorSlug);
                  if (!c) return null;
                  return (
                    <li key={item.creatorSlug} className="flex items-center gap-3 rounded-xl border border-border bg-starter-bg p-3">
                      <span className="relative h-12 w-12 overflow-hidden rounded-full">
                        <Image src={c.image} alt={c.displayName} fill className="object-cover" sizes="48px" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/creators/${c.slug}`} className="font-bold text-indigo hover:underline">
                          {c.displayName}
                        </Link>
                        <p className="truncate text-xs text-muted">{item.note ?? c.title}</p>
                      </div>
                      <form action={actionRemoveShortlist}>
                        <input type="hidden" name="slug" value={c.slug} />
                        <button type="submit" className="text-xs font-semibold text-muted hover:text-violet">
                          Remove
                        </button>
                      </form>
                    </li>
                  );
                })
              )}
            </ul>
            <form action={actionAddShortlist} className="mt-4 flex gap-2">
              <select
                name="slug"
                className="flex-1 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet"
                defaultValue=""
              >
                <option value="" disabled>
                  Add creator…
                </option>
                {["sofia-martinez", "daniel-kim", "priya-sharma", "marcus-lee", "amara-okonkwo", "jordan-blake"].map(
                  (slug) => (
                    <option key={slug} value={slug}>
                      {getCreatorBySlug(slug)?.displayName}
                    </option>
                  ),
                )}
              </select>
              <button type="submit" className="btn-primary !px-4 !py-2 text-sm">
                Add
              </button>
            </form>
          </section>

          {/* Briefs */}
          <section className="card-surface p-6">
            <h2 className="font-display text-xl font-bold text-indigo">Campaign briefs</h2>
            <ul className="mt-4 space-y-3">
              {ws.briefs.map((b) => (
                <li key={b.id} className="rounded-xl border border-border bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-indigo">{b.title}</p>
                      <p className="text-xs text-muted">
                        {b.goal} · {b.budget} · {b.location} · {b.platform}
                      </p>
                    </div>
                    <span className="rounded-full bg-lavender px-2 py-0.5 text-[10px] font-bold uppercase text-violet">
                      {b.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted">{b.summary}</p>
                </li>
              ))}
            </ul>

            <form action={actionCreateBrief} className="mt-5 space-y-3 border-t border-border pt-5">
              <p className="text-sm font-semibold text-indigo">New brief</p>
              <input
                name="title"
                required
                placeholder="Campaign title"
                className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet"
              />
              <textarea
                name="summary"
                required
                rows={2}
                placeholder="What success looks like…"
                className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet"
              />
              <div className="grid grid-cols-2 gap-2">
                <select name="specialty" className="rounded-xl border border-border px-3 py-2 text-sm">
                  {SPECIALTY_TAXONOMY.map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select name="goal" className="rounded-xl border border-border px-3 py-2 text-sm">
                  <option>Brand Awareness</option>
                  <option>Product Launch</option>
                  <option>UGC</option>
                  <option>Affiliate</option>
                </select>
                <input name="budget" defaultValue="$5K – $10K" className="rounded-xl border border-border px-3 py-2 text-sm" />
                <input name="location" defaultValue="USA" className="rounded-xl border border-border px-3 py-2 text-sm" />
                <select name="platform" className="col-span-2 rounded-xl border border-border px-3 py-2 text-sm">
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="TIKTOK">TikTok</option>
                  <option value="YOUTUBE">YouTube</option>
                </select>
              </div>
              <button type="submit" className="btn-primary w-full !py-2 text-sm">
                Create brief
              </button>
            </form>
          </section>
        </div>

        {/* Fit insights */}
        <section className="card-surface p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-indigo">Why this creator? · Fit insights</h2>
              <p className="mt-1 text-sm text-muted">
                Ranked against your active brief
                {activeBrief ? `: “${activeBrief.title}”` : ""}.
              </p>
            </div>
            {!entitlements.fitInsights ? (
              <form action={actionSetPlan}>
                <input type="hidden" name="plan" value="BUSINESS_PRO" />
                <button type="submit" className="btn-primary !py-2 text-sm">
                  Unlock with Business Pro →
                </button>
              </form>
            ) : null}
          </div>

          {!entitlements.fitInsights ? (
            <p className="mt-6 rounded-xl bg-lavender/40 p-4 text-sm text-indigo">
              Fit insights are a Business Pro feature. Free plan can browse and shortlist lightly;
              Pro explains specialty, geo, platform, and commercial readiness.
            </p>
          ) : (
            <div className="mt-6 grid gap-4">
              {ranked.map((fit) => (
                <article
                  key={fit.creator.slug}
                  className="grid gap-4 rounded-2xl border border-border bg-starter-bg p-4 md:grid-cols-[auto_1fr_auto]"
                >
                  <span className="relative mx-auto h-16 w-16 overflow-hidden rounded-full md:mx-0">
                    <Image
                      src={fit.creator.image}
                      alt={fit.creator.displayName}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/creators/${fit.creator.slug}`} className="font-bold text-indigo hover:underline">
                        {fit.creator.displayName}
                      </Link>
                      <span className="text-xs text-muted">
                        {fit.creator.specialties.slice(0, 2).map(specialtyLabel).join(" · ")}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">{fit.reasons[0]}</p>
                    <dl className="mt-2 flex flex-wrap gap-3 text-[11px] font-semibold text-muted">
                      <div>Specialty {fit.breakdown.specialtyFit}%</div>
                      <div>Geo {fit.breakdown.audienceGeo}%</div>
                      <div>Platform {fit.breakdown.platformFit}%</div>
                      <div>Commercial {fit.breakdown.commercialReadiness}%</div>
                    </dl>
                    <form action={actionSendInquiry} className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <input type="hidden" name="creatorSlug" value={fit.creator.slug} />
                      <input type="hidden" name="briefId" value={activeBrief?.id ?? ""} />
                      <input
                        name="message"
                        required
                        defaultValue={`Hi ${fit.creator.displayName.split(" ")[0]} — we'd love to collaborate on ${activeBrief?.title ?? "our campaign"}.`}
                        className="flex-1 rounded-xl border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet"
                      />
                      <button type="submit" className="btn-primary !py-2 text-sm">
                        Send inquiry
                      </button>
                    </form>
                  </div>
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center self-start rounded-full brand-gradient text-lg font-bold text-white">
                    {fit.score}%
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Inquiries */}
        <section className="card-surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-bold text-indigo">Inquiries</h2>
            <span className="text-xs font-semibold text-muted">
              Limit {entitlements.inquiryMaxPerMonth}/mo
            </span>
          </div>
          {ws.inquiries.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No inquiries yet — send one from fit insights above.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {ws.inquiries.map((inq) => {
                const c = getCreatorBySlug(inq.creatorSlug);
                return (
                  <li key={inq.id} className="rounded-xl border border-border bg-white p-4 text-sm">
                    <div className="flex justify-between gap-2">
                      <p className="font-bold text-indigo">{c?.displayName ?? inq.creatorSlug}</p>
                      <span className="text-xs font-semibold uppercase text-violet">{inq.status}</span>
                    </div>
                    <p className="mt-1 text-muted">{inq.message}</p>
                    <p className="mt-2 text-[11px] text-muted">{new Date(inq.createdAt).toLocaleString()}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
