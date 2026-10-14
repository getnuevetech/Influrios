import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconArrowRight, IconShieldPay, IconUsers } from "@/components/icons";
import { getAccountSession } from "@/lib/accounts";
import { collabOsV1Enabled } from "@/lib/collab-os";
import { leadLabel, leadTransitions, parseLocationParts } from "@/lib/business";
import { loadBusinessHub, PIPELINE_STAGES } from "@/lib/collaboration-hub";
import { listCatalogOptions } from "@/lib/catalog-options";
import { getDirectory, indexCreatorsBySlug } from "@/lib/directory";
import { hasCurrentLegalRecord } from "@/lib/legal";
import { formatStoredMoney } from "@/lib/money";
import { FUNDING_BADGE_CLASS } from "@/lib/funding-badge";
import { listFxRates } from "@/lib/settlement";
import { PlaceFields } from "@/components/place-fields";
import { SPECIALTY_TAXONOMY, formatFollowers, publicStoredImage, specialtyLabel } from "@/lib/seed-data";
import {
  actionAcceptBusinessTerms,
  actionAddShortlist,
  actionAdvanceLead,
  actionInviteCreatorToRequest,
  actionPostBusinessRequest,
  actionRefreshCampaignSuggestions,
  actionRemoveShortlist,
  actionSaveCampaignIntent,
  actionSendInquiry,
  actionShortlistFromInquiry,
  actionTransitionMarketplaceApplication,
} from "./actions";
import { applicationTransitionLabel } from "@/lib/marketplace-listings";
import { actionSendTeamProposal } from "@/app/collaboration/team/actions";
import { teamSendControl } from "@/lib/team-proposal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business Collaboration Hub · Influrios" };

type Props = {
  searchParams: Promise<{
    error?: string;
    intent?: string;
    suggestions?: string;
    refreshed?: string;
    mode?: string;
    posted?: string;
    added?: string;
    inquiry?: string;
    plan?: string;
    sent?: string;
    queued?: string;
    terms?: string;
    invited?: string;
    app?: string;
    drafted?: string;
  }>;
};

export default async function BusinessCollaborationHubPage({ searchParams }: Props) {
  if (!(await collabOsV1Enabled().catch(() => true))) {
    redirect("/collaboration/propose?notice=collab_os_off");
  }
  const params = await searchParams;
  const account = await getAccountSession().catch(() => null);
  if (!account) {
    redirect(`/login?next=${encodeURIComponent("/collaboration/business")}&gate=business`);
  }

  let hub;
  try {
  hub = await loadBusinessHub({ intentBriefId: params.intent, userId: account.id });
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
  const [collabTypes, timeframes, fxRates] = await Promise.all([
    listCatalogOptions("collab_type").catch(() => []),
    listCatalogOptions("timeframe").catch(() => []),
    listFxRates().catch(() => []),
  ]);
  const currencyOptions = ["USD", ...fxRates.filter((row) => row.active).map((row) => row.currency)];

  // #13/#15 — the form only appears when explicitly editing a draft (?intent=<id>) or
  // starting a new one (?intent=new). A bare hub visit never pre-fills a stale draft.
  const showIntentForm = params.intent === "new" || Boolean(hub.intentBrief);
  const intentLocation = parseLocationParts(hub.intentBrief?.location ?? "");

  return (
    <div className="bg-[#F4F7FF]">
      <section className="border-b border-[#E4E9F5] bg-gradient-to-r from-[#EEF5FF] via-white to-[#F7F4FF]">
        <div className="mx-auto flex w-full max-w-[90rem] flex-wrap items-end justify-between gap-4 px-4 py-8 sm:px-6 lg:px-10">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet">Business Collaboration Hub</p>
            <h1 className="mt-1 font-display text-3xl font-bold text-indigo sm:text-4xl">Campaigns & Collaborations</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Post requests, review suggestions, manage applicants, and track funded spend for{" "}
              <span className="font-semibold text-indigo">{hub.workspace.name}</span>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/collaboration/business?intent=new" className="btn-primary !py-2 text-sm">
              Create request <IconArrowRight size={14} />
            </Link>
            <Link href="/business/campaigns" className="btn-secondary !py-2 text-sm">
              Campaigns & drafts
            </Link>
            <Link href="/collaboration/team" className="btn-secondary !py-2 text-sm">
              Team proposal
            </Link>
            <Link href="/payments" className="btn-secondary !py-2 text-sm">
              Protected payments
            </Link>
          </div>
          <p className="mt-3 max-w-xl text-[11px] text-muted">
            Suggestions and managed intros connect you with Influencers. Protected milestone funding only starts
            after both parties accept a contract — an introduction is not a Fully Funded collaboration.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-[90rem] space-y-6 px-4 py-8 sm:px-6 lg:px-10">
        <div className="min-w-0 space-y-6">
          {params.error ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{params.error}</p>
          ) : null}
          {params.refreshed ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              Suggestions refreshed for your saved Campaign Intent.
            </p>
          ) : null}
          {params.suggestions && !params.refreshed ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              Campaign intent {params.mode === "update" ? "updated" : "saved"}. Suggestions refreshed
              below.
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
          {params.invited ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              Invitation sent to {params.invited}. Track it under Applicants.
            </p>
          ) : null}
          {params.app ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              Application moved to {params.app}.
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
              ["Funded Value", formatStoredMoney(hub.spend.fundedCents, hub.spend.currency)],
              ["Released Spend", formatStoredMoney(hub.spend.releasedCents, hub.spend.currency)],
              ["Completed", hub.status.completed],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-2xl border border-[#E4E9F5] bg-white p-4 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label as string}</p>
                <p className="mt-1 font-display text-2xl font-bold text-indigo">{value as string | number}</p>
              </div>
            ))}
          </div>

          <section id="drafts" className="rounded-2xl border border-[#E4E9F5] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-indigo">Campaigns & drafts</h2>
                <p className="text-sm text-muted">
                  Every Campaign Intent you have saved, draft or active. Edit one to bring back its form.
                </p>
              </div>
              <Link href="/collaboration/business?intent=new#suggestions" className="btn-primary !py-2 text-sm">
                Create request <IconArrowRight size={14} />
              </Link>
            </div>
            <ul className="mt-4 space-y-2">
              {hub.briefs.length === 0 ? (
                <li className="text-sm text-muted">No campaigns yet — create one to start getting suggestions.</li>
              ) : (
                hub.briefs.map((brief) => (
                  <li
                    key={brief.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E8EDF8] p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-indigo">{brief.title}</p>
                      <p className="text-[11px] text-muted">
                        {[brief.goal, brief.budget ? `${brief.budgetCurrency} ${brief.budget}` : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#EAE4FF] px-2 py-0.5 text-[10px] font-bold uppercase text-violet">
                        {brief.status}
                      </span>
                      <Link
                        href={`/collaboration/business?intent=${encodeURIComponent(brief.id)}#suggestions`}
                        className="text-xs font-bold text-violet hover:underline"
                      >
                        Edit
                      </Link>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section id="suggestions" className="rounded-2xl border border-[#E4E9F5] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-indigo">Get Collaboration Suggestions</h2>
                <p className="text-sm text-muted">
                  {hub.intentBrief
                    ? "Update your Campaign Intent or refresh matches as new influencers become available."
                    : showIntentForm
                      ? "Save a Campaign Intent, then refresh influencer matches for your brief."
                      : "Create a request or edit a saved draft from Campaigns & drafts to see this form."}
                </p>
                {hub.intentBrief ? (
                  <p className="mt-1 text-[11px] font-semibold text-violet">
                    Editing · {hub.intentBrief.title}
                  </p>
                ) : null}
              </div>
              {hub.intentBrief ? (
                <form action={actionRefreshCampaignSuggestions}>
                  <input type="hidden" name="briefId" value={hub.intentBrief.id} />
                  <button type="submit" className="btn-secondary !py-2 text-sm">
                    Refresh suggestions
                  </button>
                </form>
              ) : null}
            </div>
            {showIntentForm ? (
            <form action={actionSaveCampaignIntent} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {hub.intentBrief ? <input type="hidden" name="briefId" value={hub.intentBrief.id} /> : null}
              <label className="block text-xs font-bold text-indigo sm:col-span-2 lg:col-span-3">
                Campaign title
                <input
                  name="title"
                  required
                  placeholder="Campaign title"
                  defaultValue={hub.intentBrief?.title ?? ""}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal"
                />
              </label>
              <label className="block text-xs font-bold text-indigo">
                Campaign objective
                <select
                  name="goal"
                  defaultValue={hub.intentBrief?.goal ?? ""}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-medium"
                >
                  <option value=""> </option>
                  <option>Brand Awareness</option>
                  <option>Product Launch</option>
                  <option>Content Series</option>
                  <option>Event Activation</option>
                  <option>Long-term Partnership</option>
                </select>
              </label>
              <label className="block text-xs font-bold text-indigo">
                Influencer specialty
                <select name="specialty" defaultValue={hub.intentBrief?.specialty ?? ""} className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-medium">
                  <option value=""> </option>
                  {taxonomy.map((item) => (
                    <option key={item.slug} value={item.slug}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <PlaceFields
                cityName="locationCity"
                stateName="locationState"
                countryName="locationCountry"
                cityLabel="City"
                countryLabel="Country"
                stateLabel="State / region"
                defaultCity={intentLocation.city}
                defaultState={intentLocation.state}
                defaultCountry={intentLocation.country}
                className="contents"
              />
              <label className="block text-xs font-bold text-indigo">
                Budget
                <div className="mt-1 flex gap-2">
                  <select
                    name="budgetCurrency"
                    defaultValue={hub.intentBrief?.budgetCurrency ?? "USD"}
                    className="w-24 rounded-xl border border-border px-2 py-2 text-sm font-medium"
                  >
                    {currencyOptions.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                  <input
                    name="budget"
                    placeholder="Amount or range"
                    defaultValue={hub.intentBrief?.budget ?? ""}
                    className="w-full rounded-xl border border-border px-3 py-2 text-sm font-normal"
                  />
                </div>
              </label>
              <label className="block text-xs font-bold text-indigo">
                Platform
                <select name="platform" defaultValue={hub.intentBrief?.platform ?? ""} className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-medium">
                  <option value=""> </option>
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="TIKTOK">TikTok</option>
                  <option value="YOUTUBE">YouTube</option>
                  <option value="X">X</option>
                </select>
              </label>
              <label className="block text-xs font-bold text-indigo">
                Collaboration type
                <select
                  name="collabType"
                  defaultValue={hub.intentBrief?.collabType ?? ""}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-medium"
                >
                  <option value=""> </option>
                  {collabTypes.map((option) => (
                    <option key={option.id} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold text-indigo">
                Timeframe
                <select
                  name="timeframe"
                  defaultValue={hub.intentBrief?.timeframe ?? ""}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-medium"
                >
                  <option value=""> </option>
                  {timeframes.map((option) => (
                    <option key={option.id} value={option.label}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold text-indigo sm:col-span-2 lg:col-span-3">
                Audience / notes
                <input
                  name="audience"
                  placeholder="Who should this reach?"
                  defaultValue={hub.intentBrief?.summary ?? ""}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal"
                />
              </label>
              <div className="flex items-end">
                <button type="submit" className="btn-primary w-full !py-2.5 text-sm">
                  {hub.intentBrief ? "Update intent & suggest" : "Save intent & suggest"}{" "}
                  <IconArrowRight size={14} />
                </button>
              </div>
            </form>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {hub.suggestions.length === 0 ? (
                <p className="text-sm text-muted sm:col-span-2">Save a campaign intent to see influencer suggestions.</p>
              ) : (
                hub.suggestions.map(({ creator, score, reasons }) => {
                  const photo = publicStoredImage(creator.image);
                  const followers = creator.socials.reduce((sum, social) => sum + social.followers, 0);
                  const engagement = creator.stats?.engagementRate?.trim() ?? "";
                  const showEngagement = engagement.length > 0 && engagement !== "—";
                  return (
                  <article key={creator.slug} className="overflow-hidden rounded-2xl border border-[#E4E9F5] bg-[#F8FAFF] shadow-sm">
                    <div className="relative h-28 bg-gradient-to-br from-[#111A5A] to-[#633CFF]">
                      {photo ? <Image src={photo} alt="" fill className="object-cover" sizes="220px" /> : null}
                      <span className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-violet">
                        {score}% fit
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-bold text-indigo">{creator.displayName}</p>
                      <p className="text-[11px] text-muted">{creator.title}</p>
                      {followers > 0 || showEngagement ? (
                        <p className="mt-1 text-[11px] font-semibold text-indigo">
                          {followers > 0 ? formatFollowers(followers) : null}
                          {followers > 0 && showEngagement ? " · " : null}
                          {showEngagement ? `${engagement} eng.` : null}
                        </p>
                      ) : null}
                      {reasons[0] ? (
                        <p className="mt-2 line-clamp-2 rounded-lg bg-white p-2 text-[11px] text-muted">
                          {reasons[0]}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link href={`/creators/${creator.slug}`} className="btn-primary !px-3 !py-1.5 text-[11px]">
                          View Profile
                        </Link>
                        <form action={actionAddShortlist}>
                          <input type="hidden" name="slug" value={creator.slug} />
                          <button type="submit" className="btn-secondary !px-3 !py-1.5 text-[11px]">
                            Shortlist
                          </button>
                        </form>
                        <form action={actionSendInquiry} className="basis-full">
                          <input type="hidden" name="creatorSlug" value={creator.slug} />
                          {hub.intentBrief ? (
                            <input type="hidden" name="briefId" value={hub.intentBrief.id} />
                          ) : null}
                          <textarea
                            name="message"
                            required
                            rows={2}
                            placeholder="Write a message"
                            className="w-full rounded-xl border border-border px-2 py-1 text-[11px] font-normal"
                          />
                          <button type="submit" className="btn-secondary mt-1 !px-3 !py-1.5 text-[11px]">
                            Inquire
                          </button>
                        </form>
                        <Link
                          href={`/collaboration/contract?creator=${encodeURIComponent(creator.slug)}`}
                          className="btn-secondary !px-3 !py-1.5 text-[11px]"
                        >
                          Contract
                        </Link>
                        {hub.ownRequests[0] ? (
                          <form action={actionInviteCreatorToRequest}>
                            <input type="hidden" name="creatorSlug" value={creator.slug} />
                            <input type="hidden" name="requestId" value={hub.ownRequests[0].id} />
                            <button type="submit" className="btn-secondary !px-3 !py-1.5 text-[11px]">
                              Invite
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </article>
                  );
                })
              )}
            </div>
            {params.sent ? (
              <p className="mt-3 text-sm font-semibold text-emerald-700">
                Team proposal sent. It opens a contract after every creator accepts.{" "}
                <Link href="/collaboration/team" className="text-violet hover:underline">
                  View proposals
                </Link>
              </p>
            ) : null}
            {teamSendControl({ audience: "business" }).visible && hub.suggestions.length >= 1 ? (
              <form action={actionSendTeamProposal} className="mt-4 space-y-2 rounded-xl border border-[#E4E9F5] bg-[#F8FAFF] p-4">
                <input type="hidden" name="returnTo" value="/collaboration/business" />
                <input type="hidden" name="title" value={hub.intentBrief?.title ?? ""} />
                <input
                  type="hidden"
                  name="campaignIntent"
                  value={[hub.intentBrief?.goal, hub.intentBrief?.summary].filter(Boolean).join(" · ") || hub.intentBrief?.title || ""}
                />
                <fieldset className="space-y-1">
                  <legend className="text-sm font-semibold text-indigo">Send a team proposal</legend>
                  <p className="text-xs text-muted">Select one or more suggestions. One proposal, one contract, one funding instruction.</p>
                  {hub.suggestions.map(({ creator }) => (
                    <label key={creator.slug} className="flex items-center gap-2 text-sm text-indigo">
                      <input type="checkbox" name="creatorSlug" value={creator.slug} />
                      {creator.displayName}
                    </label>
                  ))}
                </fieldset>
                <button type="submit" className="btn-primary !py-2 text-sm">
                  Send team proposal
                </button>
              </form>
            ) : null}
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
                {hub.applications.length === 0 && hub.inquiries.length === 0 ? (
                  <li className="text-sm text-muted">
                    No applications yet. Invite from suggestions or wait for creators to apply.
                  </li>
                ) : null}
                {hub.applications.map((application) => {
                  const creator = application.creatorSlug
                    ? bySlug.get(application.creatorSlug)
                    : null;
                  return (
                    <li key={application.id} className="flex gap-3 rounded-xl border border-[#E8EDF8] p-3">
                      <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#F4F7FF]">
                        {creator ? (
                          <Image src={creator.image} alt="" fill className="object-cover" sizes="44px" />
                        ) : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-indigo">
                          {creator?.displayName ?? application.creatorSlug ?? "Applicant"}
                        </p>
                        {[application.requestBrand?.trim(), application.note?.trim()].filter(Boolean).length > 0 ? (
                          <p className="text-[11px] text-muted">
                            {[application.requestBrand?.trim(), application.note?.trim()].filter(Boolean).join(" · ")}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[10px] font-semibold uppercase text-violet">
                          {application.status}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {application.nextStatuses.map((status) => (
                              <form key={status} action={actionTransitionMarketplaceApplication}>
                                <input type="hidden" name="applicationId" value={application.id} />
                                <input type="hidden" name="toStatus" value={status} />
                                <button
                                  type="submit"
                                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                                    status === "DECLINED" || status === "WITHDRAWN" || status === "EXPIRED"
                                      ? "border border-border text-muted"
                                      : status === "COLLABORATION_DRAFTED" || status === "ACCEPTED"
                                        ? "bg-violet text-white"
                                        : "border border-violet/30 text-violet"
                                  }`}
                                >
                                  {applicationTransitionLabel(status)}
                                </button>
                              </form>
                            ))}
                          {application.status === "COLLABORATION_DRAFTED" && application.creatorSlug ? (
                            <Link
                              href={`/collaboration/contract?creator=${encodeURIComponent(application.creatorSlug)}`}
                              className="rounded-lg bg-violet px-2.5 py-1 text-[11px] font-bold text-white"
                            >
                              Open contract
                            </Link>
                          ) : null}
                        </div>
                        {application.events.length > 0 ? (
                          <ol className="mt-2 space-y-1 border-t border-[#E8EDF8] pt-2">
                            {application.events.map((event) => (
                              <li key={event.id} className="text-[10px] text-muted">
                                <span className="font-semibold text-indigo">
                                  {event.fromStatus ? `${event.fromStatus} → ` : ""}
                                  {event.toStatus}
                                </span>
                                {event.note ? ` · ${event.note}` : ""}
                                {" · "}
                                {new Date(event.createdAt).toLocaleString()}
                              </li>
                            ))}
                          </ol>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
                {hub.inquiries.map((inquiry) => {
                    const creator = bySlug.get(inquiry.creatorSlug);
                    const nextStages = leadTransitions(inquiry.status);
                    return (
                      <li key={inquiry.id} className="flex gap-3 rounded-xl border border-[#E8EDF8] p-3">
                        <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#F4F7FF]">
                          {creator ? <Image src={creator.image} alt="" fill className="object-cover" sizes="44px" /> : null}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-indigo">{creator?.displayName ?? inquiry.creatorSlug}</p>
                          <p className="line-clamp-2 text-xs text-muted">{inquiry.message}</p>
                          <p className="mt-1 text-[10px] font-semibold uppercase text-violet">{leadLabel(inquiry.status)}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {nextStages.map((status) => (
                              <form key={status} action={actionAdvanceLead}>
                                <input type="hidden" name="inquiryId" value={inquiry.id} />
                                <input type="hidden" name="status" value={status} />
                                <button type="submit" className="rounded-lg bg-violet px-2.5 py-1 text-[11px] font-bold text-white">
                                  {leadLabel(status)}
                                </button>
                              </form>
                            ))}
                            <form action={actionShortlistFromInquiry}>
                              <input type="hidden" name="creatorSlug" value={inquiry.creatorSlug} />
                              <button type="submit" className="rounded-lg border border-violet/30 px-2.5 py-1 text-[11px] font-bold text-violet">
                                Shortlist
                              </button>
                            </form>
                          </div>
                        </div>
                      </li>
                    );
                  })}
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
                      placeholder="Write a message"
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
                        {creator.title?.trim() ? (
                          <p className="truncate text-[11px] text-muted">{creator.title}</p>
                        ) : null}
                        {item.note?.trim() ? (
                          <p className="truncate text-[11px] text-muted">{item.note}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Link
                          href={`/collaboration/contract?creator=${encodeURIComponent(creator.slug)}`}
                          className="text-[11px] font-bold text-violet hover:underline"
                        >
                          Contract
                        </Link>
                        {hub.ownRequests[0] ? (
                          <form action={actionInviteCreatorToRequest}>
                            <input type="hidden" name="creatorSlug" value={creator.slug} />
                            <input type="hidden" name="requestId" value={hub.ownRequests[0].id} />
                            <button type="submit" className="text-[11px] font-bold text-violet hover:underline">
                              Invite
                            </button>
                          </form>
                        ) : null}
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
                        <p className="text-[11px] text-muted">
                          with {item.counterparty}
                          {item.fundingBadge ? (
                            <>
                              {" "}
                              ·{" "}
                              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${FUNDING_BADGE_CLASS[item.fundingBadge]}`}>
                                {item.fundingBadge}
                              </span>
                            </>
                          ) : null}
                          {item.feeCents != null && item.currency
                            ? ` · fee locked ${formatStoredMoney(item.feeCents, item.currency)}`
                            : ""}
                          {item.revisionSummary ? ` · ${item.revisionSummary}` : ""}
                        </p>
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
                    {formatStoredMoney(cents as number, hub.spend.currency)}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              {hub.spend.dealCount} deal{hub.spend.dealCount === 1 ? "" : "s"} matched to this business name in the ledger.
            </p>
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
