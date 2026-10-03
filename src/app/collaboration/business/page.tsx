import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  IconArrowRight,
  IconBuilding,
  IconShieldPay,
  IconUsers,
} from "@/components/icons";
import { getAccountSession } from "@/lib/accounts";
import { getCreatorSessionDraft } from "@/lib/claim";
import { loadBusinessHub, PIPELINE_STAGES } from "@/lib/collaboration-hub";
import { BUSINESS_PLAN_PRICES, type BusinessPlanCode } from "@/lib/business-entitlements";
import { getDirectory, indexCreatorsBySlug } from "@/lib/directory";
import { hasCurrentLegalRecord } from "@/lib/legal";
import { formatMoney } from "@/lib/money";
import { SPECIALTY_TAXONOMY, formatFollowers, specialtyLabel } from "@/lib/seed-data";
import {
  actionAcceptBusinessTerms,
  actionAddShortlist,
  actionPostBusinessRequest,
  actionRemoveShortlist,
  actionSaveCampaignIntent,
  actionSendInquiry,
  actionSetPlan,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business Collaboration Hub · Influrios" };

type Props = {
  searchParams: Promise<{
    error?: string;
    intent?: string;
    suggestions?: string;
    posted?: string;
    added?: string;
    inquiry?: string;
    plan?: string;
    queued?: string;
    terms?: string;
  }>;
};

const SIDE_LINKS = [
  { href: "/collaboration/business", label: "Business Hub" },
  { href: "/collaboration/business#suggestions", label: "Influencer Suggestions" },
  { href: "/collaboration/business#requests", label: "My Requests" },
  { href: "/collaboration/business#applicants", label: "Applicants & Inquiries" },
  { href: "/collaboration/business#shortlist", label: "Shortlist" },
  { href: "/collaboration/business#spend", label: "Spend & Fees" },
  { href: "/collaboration/contract", label: "Contract Wizard" },
  { href: "/payments", label: "Protected Payments" },
  { href: "/business/intelligence", label: "Intelligence" },
  { href: "/discover", label: "Find Influencers" },
  { href: "/account", label: "Settings" },
] as const;

export default async function BusinessCollaborationHubPage({ searchParams }: Props) {
  const params = await searchParams;
  const account = await getAccountSession().catch(() => null);
  if (!account) {
    redirect(`/login?next=${encodeURIComponent("/collaboration/business")}&gate=business`);
  }

  const draft = await getCreatorSessionDraft().catch(() => null);
  let hub;
  try {
    hub = await loadBusinessHub({ intentBriefId: params.intent });
  } catch {
    return (
      <div className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The business collaboration hub is unavailable right now.
        </div>
      </div>
    );
  }

  const directory = await getDirectory().catch(() => null);
  const bySlug = indexCreatorsBySlug(directory?.creators ?? []);
  const businessTermsAccepted = await hasCurrentLegalRecord({
    documentKey: "business-terms",
    userId: account.id,
  }).catch(() => false);
  const taxonomy = directory?.taxonomy?.length
    ? directory.taxonomy
    : SPECIALTY_TAXONOMY.map((item) => ({ slug: item.slug, name: item.name }));

  return (
    <div className="bg-[#F4F7FF]">
      <section className="border-b border-[#E4E9F5] bg-gradient-to-r from-[#EEF5FF] via-white to-[#F7F4FF]">
        <div className="mx-auto flex w-full max-w-[90rem] flex-wrap items-end justify-between gap-4 px-4 py-8 sm:px-6 lg:px-10">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet">Business Collaboration Hub</p>
            <h1 className="mt-1 font-display text-3xl font-bold text-indigo sm:text-4xl">Campaigns & Collaborations</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Post requests, get influencer suggestions, manage applicants, and track funded spend — without creator-side chrome.
            </p>
            {draft?.slug ? (
              <Link href="/collaboration/hub" className="mt-2 inline-flex text-xs font-bold text-violet hover:underline">
                Switch to Influencer Hub →
              </Link>
            ) : (
              <Link href="/collaboration?landing=1" className="mt-2 inline-flex text-xs font-bold text-violet hover:underline">
                View public collaboration landing →
              </Link>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="#create-request" className="btn-primary !py-2 text-sm">
              Post Request <IconArrowRight size={14} />
            </a>
            <a href="#suggestions" className="btn-secondary !py-2 text-sm">
              Get Suggestions
            </a>
            <Link href="/collaboration/contract" className="btn-secondary !py-2 text-sm">
              Start Contract
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-[90rem] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-10">
        <aside className="space-y-4">
          <div className="rounded-2xl border border-[#E4E9F5] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EAE4FF] text-violet">
                <IconBuilding size={22} />
              </span>
              <div className="min-w-0">
                <p className="font-display text-lg font-bold text-indigo">{hub.workspace.name}</p>
                <p className="text-xs text-muted">{hub.workspace.industry}</p>
                <p className="mt-1 text-[11px] font-semibold text-violet">
                  {BUSINESS_PLAN_PRICES[hub.workspace.plan].label} plan
                </p>
              </div>
            </div>
            <Link href="/business" className="btn-secondary mt-4 w-full !py-2 text-center text-xs">
              Marketing page
            </Link>
          </div>
          <nav className="rounded-2xl border border-[#E4E9F5] bg-white p-2 shadow-sm">
            {SIDE_LINKS.map((link) => {
              const active = link.href === "/collaboration/business";
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  className={`block rounded-xl px-3 py-2 text-sm font-semibold ${
                    active ? "bg-[#EAE4FF] text-violet" : "text-indigo hover:bg-[#F4F7FF]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 space-y-6">
          {params.error ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{params.error}</p>
          ) : null}
          {params.suggestions ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              Campaign intent saved. Suggestions refreshed below.
            </p>
          ) : null}
          {params.posted ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              Business request published to the collaboration marketplace.
            </p>
          ) : null}
          {params.added ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              Added to shortlist: {params.added}
            </p>
          ) : null}
          {params.inquiry ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              Inquiry sent.
            </p>
          ) : null}
          {params.queued ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              Managed matching queued for review.
            </p>
          ) : null}

          {!businessTermsAccepted ? (
            <form action={actionAcceptBusinessTerms} className="rounded-2xl border border-[#E4E9F5] bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-indigo">Business terms</p>
              <label className="mt-3 flex items-start gap-2 text-sm text-indigo">
                <input type="checkbox" name="acceptBusiness" required className="mt-1 accent-[#633CFF]" />
                <span>
                  I agree to the{" "}
                  <Link href="/legal/terms-of-service" className="font-semibold underline" target="_blank">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/legal/business-terms" className="font-semibold underline" target="_blank">
                    Business / Brand Terms
                  </Link>
                  .
                </span>
              </label>
              <button type="submit" className="btn-primary mt-4 !py-2 text-sm">
                Accept business terms
              </button>
            </form>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ["Active Collaborations", hub.status.active],
              ["Draft Requests", hub.status.draftRequests],
              ["Pending Responses", hub.status.pendingReview],
              ["Funded Value", formatMoney(hub.spend.fundedCents, hub.spend.currency)],
              ["Released Spend", formatMoney(hub.spend.releasedCents, hub.spend.currency)],
              ["Completed", hub.status.completed],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-2xl border border-[#E4E9F5] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label as string}</p>
                <p className="mt-1 font-display text-2xl font-bold text-indigo">{value as string | number}</p>
              </div>
            ))}
          </div>

          <section id="suggestions" className="rounded-2xl border border-[#E4E9F5] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-indigo">Get Collaboration Suggestions</h2>
                <p className="text-sm text-muted">
                  Save a Campaign Intent, then refresh influencer matches for your brief.
                </p>
              </div>
            </div>
            <form action={actionSaveCampaignIntent} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block text-xs font-bold text-indigo">
                Campaign objective
                <select name="goal" className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-medium">
                  <option>Brand Awareness</option>
                  <option>Product Launch</option>
                  <option>Content Series</option>
                  <option>Event Activation</option>
                  <option>Long-term Partnership</option>
                </select>
              </label>
              <label className="block text-xs font-bold text-indigo">
                Influencer specialty
                <select name="specialty" defaultValue={hub.intentBrief?.specialty ?? "beauty"} className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-medium">
                  {taxonomy.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold text-indigo">
                Geography
                <input name="location" defaultValue={hub.intentBrief?.location ?? "Global"} className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal" />
              </label>
              <label className="block text-xs font-bold text-indigo">
                Budget
                <input name="budget" defaultValue={hub.intentBrief?.budget ?? "$1K – $5K"} className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal" />
              </label>
              <label className="block text-xs font-bold text-indigo">
                Platform
                <select name="platform" defaultValue={hub.intentBrief?.platform ?? "INSTAGRAM"} className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-medium">
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="TIKTOK">TikTok</option>
                  <option value="YOUTUBE">YouTube</option>
                  <option value="X">X</option>
                </select>
              </label>
              <label className="block text-xs font-bold text-indigo">
                Collaboration type
                <input name="collabType" placeholder="Brand partnership, review…" className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal" />
              </label>
              <label className="block text-xs font-bold text-indigo sm:col-span-2 lg:col-span-3">
                Audience / notes
                <input name="audience" placeholder="Who should this reach?" className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal" />
              </label>
              <label className="block text-xs font-bold text-indigo sm:col-span-2 lg:col-span-2">
                Timeframe
                <input name="timeframe" placeholder="Next 30 days / Q4" className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal" />
              </label>
              <div className="flex items-end">
                <button type="submit" className="btn-primary w-full !py-2.5 text-sm">
                  Save intent & suggest <IconArrowRight size={14} />
                </button>
              </div>
            </form>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {hub.suggestions.length === 0 ? (
                <p className="text-sm text-muted sm:col-span-2">Save a campaign intent to see influencer suggestions.</p>
              ) : (
                hub.suggestions.map(({ creator, score, reasons }) => (
                  <article key={creator.slug} className="overflow-hidden rounded-2xl border border-[#E4E9F5] bg-[#F8FAFF] shadow-sm">
                    <div className="relative h-28">
                      <Image src={creator.image} alt="" fill className="object-cover" sizes="220px" />
                      <span className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-violet">
                        {score}% fit
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-bold text-indigo">{creator.displayName}</p>
                      <p className="text-[11px] text-muted">{creator.title}</p>
                      <p className="mt-1 text-[11px] font-semibold text-indigo">
                        {formatFollowers(creator.socials.reduce((sum, s) => sum + s.followers, 0))} ·{" "}
                        {creator.stats?.engagementRate ?? "—"} eng.
                      </p>
                      <p className="mt-2 line-clamp-2 rounded-lg bg-white p-2 text-[11px] text-muted">
                        {reasons[0] ?? "Strong specialty and market fit for this brief."}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link href={`/creators/${creator.slug}`} className="btn-primary !px-3 !py-1.5 text-[11px]">
                          View Profile
                        </Link>
                        <form action={actionAddShortlist}>
                          <input type="hidden" name="slug" value={creator.slug} />
                          <input type="hidden" name="note" value={`Suggested for ${hub.intentBrief?.title ?? "campaign"}`} />
                          <button type="submit" className="btn-secondary !px-3 !py-1.5 text-[11px]">
                            Shortlist
                          </button>
                        </form>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
            {!hub.entitlements.fitInsights ? (
              <p className="mt-3 text-xs text-muted">
                Showing a limited preview.{" "}
                <a href="#pricing" className="font-semibold text-violet">
                  Upgrade
                </a>{" "}
                for full fit insights.
              </p>
            ) : null}
          </section>

          <section id="create-request" className="rounded-2xl border border-[#E4E9F5] bg-gradient-to-r from-[#633CFF] to-[#2979FF] p-5 text-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold">Post a Business Request</h2>
                <p className="mt-1 text-sm text-white/85">
                  Publish your latest campaign intent to the marketplace so influencers can apply.
                </p>
              </div>
              <form action={actionPostBusinessRequest}>
                {hub.intentBrief ? <input type="hidden" name="briefId" value={hub.intentBrief.id} /> : null}
                <button type="submit" className="ink-on-light rounded-full bg-white px-5 py-2.5 text-sm font-bold">
                  Publish request <IconArrowRight size={14} />
                </button>
              </form>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section id="requests" className="rounded-2xl border border-[#E4E9F5] bg-white p-5 shadow-sm">
              <h2 className="font-display text-lg font-bold text-indigo">Posted Requests</h2>
              <ul className="mt-3 space-y-3">
                {hub.ownRequests.length === 0 && hub.briefs.length === 0 ? (
                  <li className="text-sm text-muted">No requests yet — save an intent and publish.</li>
                ) : null}
                {hub.ownRequests.map((item) => (
                  <li key={item.id} className="rounded-xl border border-[#E8EDF8] p-3">
                    <p className="text-sm font-bold text-indigo">{item.brand}</p>
                    <p className="text-[11px] text-muted">
                      {item.budget} · {item.location} · {item.category}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted">{item.summary}</p>
                  </li>
                ))}
                {hub.briefs.slice(0, 4).map((brief) => (
                  <li key={brief.id} className="rounded-xl border border-[#E8EDF8] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-indigo">{brief.title}</p>
                      <span className="rounded-full bg-[#EAE4FF] px-2 py-0.5 text-[10px] font-bold uppercase text-violet">
                        {brief.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted">
                      {brief.goal} · {brief.budget}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section id="applicants" className="rounded-2xl border border-[#E4E9F5] bg-white p-5 shadow-sm">
              <h2 className="font-display text-lg font-bold text-indigo">Applicants & Inquiries</h2>
              <ul className="mt-3 space-y-3">
                {hub.inquiries.length === 0 ? (
                  <li className="text-sm text-muted">No inquiries yet. Shortlist an influencer and send a note.</li>
                ) : (
                  hub.inquiries.map((inquiry) => {
                    const creator = bySlug.get(inquiry.creatorSlug);
                    return (
                      <li key={inquiry.id} className="flex gap-3 rounded-xl border border-[#E8EDF8] p-3">
                        <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#F4F7FF]">
                          {creator ? <Image src={creator.image} alt="" fill className="object-cover" sizes="44px" /> : null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-indigo">{creator?.displayName ?? inquiry.creatorSlug}</p>
                          <p className="line-clamp-2 text-xs text-muted">{inquiry.message}</p>
                          <p className="mt-1 text-[10px] font-semibold uppercase text-violet">{inquiry.status}</p>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
              {hub.suggestions[0] ? (
                <form action={actionSendInquiry} className="mt-4 space-y-2 border-t border-[#E4E9F5] pt-4">
                  <input type="hidden" name="creatorSlug" value={hub.suggestions[0].creator.slug} />
                  {hub.intentBrief ? <input type="hidden" name="briefId" value={hub.intentBrief.id} /> : null}
                  <label className="block text-xs font-bold text-indigo">
                    Quick inquiry to top suggestion
                    <textarea
                      name="message"
                      required
                      rows={2}
                      defaultValue={`Hi ${hub.suggestions[0].creator.displayName} — we'd love to collaborate on ${hub.intentBrief?.goal ?? "a campaign"}.`}
                      className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal"
                    />
                  </label>
                  <button type="submit" className="btn-primary !py-2 text-xs">
                    Send inquiry
                  </button>
                </form>
              ) : null}
            </section>
          </div>

          <section id="shortlist" className="rounded-2xl border border-[#E4E9F5] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-indigo">Shortlist</h2>
              <span className="text-xs font-semibold text-muted">
                {hub.shortlist.length} / {hub.entitlements.shortlistMax}
              </span>
            </div>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {hub.shortlist.length === 0 ? (
                <li className="text-sm text-muted">Empty — shortlist from suggestions or Discover.</li>
              ) : (
                hub.shortlist.map((item) => {
                  const creator = bySlug.get(item.creatorSlug);
                  if (!creator) return null;
                  return (
                    <li key={item.creatorSlug} className="flex items-center gap-3 rounded-xl border border-[#E8EDF8] p-3">
                      <span className="relative h-12 w-12 overflow-hidden rounded-full">
                        <Image src={creator.image} alt="" fill className="object-cover" sizes="48px" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/creators/${creator.slug}`} className="text-sm font-bold text-indigo hover:underline">
                          {creator.displayName}
                        </Link>
                        <p className="truncate text-[11px] text-muted">{item.note ?? creator.title}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Link
                          href={`/collaboration/contract?creator=${encodeURIComponent(creator.slug)}`}
                          className="text-[11px] font-bold text-violet hover:underline"
                        >
                          Contract
                        </Link>
                        <form action={actionRemoveShortlist}>
                          <input type="hidden" name="slug" value={creator.slug} />
                          <button type="submit" className="text-[11px] font-semibold text-muted hover:text-violet">
                            Remove
                          </button>
                        </form>
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          <section id="pipeline" className="rounded-2xl border border-[#E4E9F5] bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-bold text-indigo">Active Collaboration Pipeline</h2>
            <p className="text-sm text-muted">Funded deals for {hub.workspace.name} mapped to Match → Released.</p>
            {hub.pipeline.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No funded collaborations yet.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {hub.pipeline.map((item) => (
                  <li key={item.id} className="rounded-xl border border-[#E8EDF8] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-indigo">{item.title}</p>
                        <p className="text-[11px] text-muted">with {item.counterparty}</p>
                      </div>
                      <Link href={item.href} className="text-xs font-bold text-violet">
                        Open →
                      </Link>
                    </div>
                    <ol className="mt-3 flex flex-wrap gap-1.5">
                      {PIPELINE_STAGES.map((stage, index) => (
                        <li
                          key={stage}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            index <= item.stageIndex ? "bg-violet text-white" : "bg-[#F4F7FF] text-muted"
                          }`}
                        >
                          {stage}
                        </li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="spend" className="rounded-2xl border border-[#E4E9F5] bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <IconShieldPay size={18} className="text-violet" />
              <h2 className="font-display text-lg font-bold text-indigo">Spend & Fee Summary</h2>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ["Funded", hub.spend.fundedCents],
                ["Held", hub.spend.heldCents],
                ["Released", hub.spend.releasedCents],
                ["Refunded", hub.spend.refundedCents],
                ["Platform fee", hub.spend.feeCents],
              ].map(([label, cents]) => (
                <div key={label as string} className="rounded-xl bg-[#F8FAFF] p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label as string}</p>
                  <p className="mt-1 font-display text-lg font-bold text-indigo">
                    {formatMoney(cents as number, hub.spend.currency)}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              {hub.spend.dealCount} deal{hub.spend.dealCount === 1 ? "" : "s"} matched to this business name in the ledger.
            </p>
          </section>

          <section id="pricing" className="rounded-2xl border border-[#E4E9F5] bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-bold text-indigo">Business plans</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {(Object.keys(BUSINESS_PLAN_PRICES) as BusinessPlanCode[]).map((code) => {
                const price = BUSINESS_PLAN_PRICES[code];
                const active = hub.workspace.plan === code;
                return (
                  <form
                    key={code}
                    action={actionSetPlan}
                    className={`rounded-2xl border p-4 ${active ? "border-violet bg-[#F7F4FF]" : "border-[#E4E9F5]"}`}
                  >
                    <input type="hidden" name="plan" value={code} />
                    <p className="text-xs font-bold uppercase tracking-wide text-violet">{price.label}</p>
                    <p className="mt-1 font-display text-xl font-bold text-indigo">
                      {price.price}
                      <span className="text-sm font-medium text-muted">{price.period}</span>
                    </p>
                    <button type="submit" className={`mt-3 w-full !py-2 text-sm ${active ? "btn-secondary" : "btn-primary"}`}>
                      {active ? "Current plan" : "Use this plan"}
                    </button>
                  </form>
                );
              })}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-[#E4E9F5] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <IconUsers size={18} className="text-violet" />
                <h2 className="font-display text-lg font-bold text-indigo">Open influencer opportunities</h2>
              </div>
              <Link href="/discover" className="text-xs font-bold text-violet">
                Browse Discover →
              </Link>
            </div>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {hub.opportunities.map((item) => {
                const creator = bySlug.get(item.creatorSlug);
                if (!creator) return null;
                return (
                  <li key={item.id} className="flex gap-3 rounded-xl border border-[#E8EDF8] p-3">
                    <span className="relative h-12 w-12 overflow-hidden rounded-full">
                      <Image src={creator.image} alt="" fill className="object-cover" sizes="48px" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-indigo">{creator.displayName}</p>
                      <p className="text-[11px] text-muted">Looking for {item.lookingFor}</p>
                      <p className="mt-1 flex flex-wrap gap-1">
                        {creator.specialties.slice(0, 2).map((slug) => (
                          <span key={slug} className="rounded-full bg-[#EAE4FF] px-2 py-0.5 text-[10px] font-semibold text-violet">
                            {specialtyLabel(slug)}
                          </span>
                        ))}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
