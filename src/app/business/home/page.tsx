import Link from "next/link";
import { redirect } from "next/navigation";
import { Panel, StatCard, StatusPill, TextLink } from "@/components/dashboard-ui";
import { UnavailableNote } from "@/components/unavailable-note";
import {
  IconBookmark,
  IconFileText,
  IconIntelligence,
  IconPlus,
  IconStar,
  IconUsers,
  IconVerified,
  IconWallet,
  SocialIcon,
} from "@/components/icons";
import { getAccountSession } from "@/lib/accounts";
import { syncAccountNotices } from "@/lib/account-notices";
import { businessAttentionDrafts } from "@/lib/notice-filters";
import { getWorkspace, leadIsOpen } from "@/lib/business";
import {
  activeCollaborationIds,
  businessTrustLabels,
  dashboardOpenRequests,
  formatPeriodFunding,
  loadAccountBusinessVerification,
  loadMonthlyBusinessFunding,
  loadOccupiedSeats,
  newIncidentReference,
  profileIsComplete,
} from "@/lib/business-status";
import { loadBusinessHub } from "@/lib/collaboration-hub";
import { contractPartyProgress, listContractsForUser } from "@/lib/contract-document";
import { prisma } from "@/lib/db";
import { loadPlanMatrix } from "@/lib/plan-matrix";
import { formatFollowers, specialtyLabel } from "@/lib/seed-data";
import { syncedFollowerTotal } from "@/lib/social-sync";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business account" };

function relativeTime(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return minutes <= 1 ? "just now" : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "1 day ago" : `${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;
}

function requestStatusTone(status: string): "success" | "info" | "warn" | "neutral" | "violet" {
  const value = status.toLowerCase();
  if (value === "active" || value === "open" || value === "published") return "success";
  if (value === "in review" || value === "review" || value.includes("review")) return "info";
  if (value === "negotiating" || value.includes("negotiat")) return "warn";
  if (value === "draft") return "neutral";
  return "violet";
}

function requestStatusLabel(status: string) {
  const value = status.trim();
  if (!value) return "Open";
  if (value === "active") return "Open";
  if (value === "closed") return "Closed";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function firstName(full: string | null | undefined) {
  const part = (full || "").trim().split(/\s+/)[0];
  return part || null;
}

export default async function BusinessHomePage() {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/business/home");
  if (account.role === "AGENCY") redirect("/agency");
  const workspace = await getWorkspace(account.id).catch(() => null);
  const [matrix, hubResult, profileLoad, subscriptionLoad, contractLoad, verification, seats, monthly] = await Promise.all([
    loadPlanMatrix("business"),
    loadBusinessHub({ userId: account.id })
      .then((hub) => ({ hub, incident: "" }))
      .catch((error) => {
        const incident = newIncidentReference();
        console.error("business hub", incident, error);
        return { hub: null, incident };
      }),
    prisma.businessProfile
      .findUnique({
        where: { userId: account.id },
        select: { contactName: true, contactEmail: true, contactPhone: true, geography: true },
      })
      .then((row) => ({ row, incident: "" }))
      .catch((error) => {
        const incident = newIncidentReference();
        console.error("business profile", incident, error);
        return { row: null, incident };
      }),
    prisma.subscriptionState
      .findFirst({ where: { userId: account.id }, orderBy: { updatedAt: "desc" } })
      .then((row) => ({ row, incident: "" }))
      .catch((error) => {
        const incident = newIncidentReference();
        console.error("business subscription", incident, error);
        return { row: null, incident };
      }),
    listContractsForUser(account.id, account.email)
      .then((rows) => ({ rows, incident: "" }))
      .catch((error) => {
        const incident = newIncidentReference();
        console.error("business contracts", incident, error);
        return { rows: [], incident };
      }),
    loadAccountBusinessVerification(account.id),
    loadOccupiedSeats(account.id),
    workspace ? loadMonthlyBusinessFunding(workspace.businessId) : Promise.resolve({ ok: false as const, incident: newIncidentReference() }),
  ]);
  const hub = hubResult.hub;
  const profile = profileLoad.row;
  const subscription = subscriptionLoad.row;
  const contracts = contractLoad.rows;
  if (!workspace) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold">Business account</h1>
        <p className="mt-2 text-sm text-muted">Workspace details are unavailable right now.</p>
      </div>
    );
  }
  const contactName = profile?.contactName?.trim() || null;
  const greetName = firstName(contactName) || firstName(account.name) || "there";
  const companyName = workspace.name.trim() || "your workspace";

  const entitlements = hub?.entitlements ?? null;
  const planColumn = matrix.plans.find((plan) => plan.code === workspace.plan);
  const planName = planColumn?.name ?? workspace.plan;
  const planPrice = (planColumn?.priceLabel || "Free").trim();
  const planPriceDisplay =
    !planPrice || planPrice.toLowerCase() === "free"
      ? null
      : planPrice.includes("/") || /mo(nth)?/i.test(planPrice)
        ? planPrice
        : `${planPrice} / month`;
  const planBadgeLabel = planPriceDisplay ? `${planName} ${planPriceDisplay}` : planName;
  const checks = [
    { label: "Company name", done: Boolean(workspace.name.trim()) },
    { label: "Industry", done: Boolean(workspace.industry.trim()) },
    { label: "Location", done: Boolean(profile?.geography?.trim()) },
    { label: "Contact person", done: Boolean(contactName) },
    { label: "A brief / request", done: workspace.briefs.length > 0 },
    { label: "A saved creator", done: workspace.shortlist.length > 0 },
  ];
  const complete = checks.filter((item) => item.done).length;
  const setupPercent = Math.round((complete / checks.length) * 100);
  const sortedBriefs = [...workspace.briefs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const draftBriefs = sortedBriefs.filter((brief) => brief.status === "draft").slice(0, 5);
  const recentBriefs = sortedBriefs.filter((brief) => brief.status !== "draft").slice(0, 6);
  const marketplaceRequests = hub?.ownRequests ?? [];
  const suggestions = hub?.suggestions ?? [];
  const applications = hub?.applications ?? [];
  const requestsUnavailable = !hub || hub.sections.requests === "unavailable";
  const fundingsUnavailable = !hub || hub.sections.fundings === "unavailable";
  const applicationsUnavailable = !hub || hub.sections.applications === "unavailable";
  const openRequests = requestsUnavailable
    ? null
    : dashboardOpenRequests({ briefs: workspace.briefs, requests: hub.ownRequests });
  const activeRequests = openRequests ? openRequests.count : null;
  const pendingResponses = workspace.inquiries.filter((inquiry) => leadIsOpen(inquiry.status)).length;
  const activeCollabs = fundingsUnavailable ? null : activeCollaborationIds(hub.pipeline).length;
  const contentInReview = fundingsUnavailable ? null : hub.pipeline.filter((item) => item.stage === "Review").length;
  const periodFunding = monthly.ok ? formatPeriodFunding(monthly.rows) : null;
  const teamSeats = entitlements?.teamSeats ?? null;
  const seatsUsed = seats.ok ? seats.used : null;
  const trust = businessTrustLabels({
    profileComplete: profileIsComplete({
      name: workspace.name,
      industry: workspace.industry,
      contactName: contactName ?? "",
    }),
    profileUnavailable: Boolean(profileLoad.incident),
    verification: verification.state,
  });
  const bio =
    workspace.industry.trim()
      ? `${companyName} works in ${workspace.industry}. Discover creators, publish requests, and manage collaborations from one place.`
      : "Add your industry and company details so creators know who they are working with.";

  const responded = applications.filter((app) =>
    ["RESPONDED", "NEGOTIATING", "ACCEPTED", "COLLABORATION_DRAFTED"].includes(app.status),
  ).length;
  const responseRate = applicationsUnavailable
    ? null
    : applications.length > 0
      ? Math.round((responded / applications.length) * 100)
      : null;

  const appsByRequest = new Map<string, typeof applications>();
  for (const app of applications) {
    if (!app.businessRequestId) continue;
    const list = appsByRequest.get(app.businessRequestId) ?? [];
    list.push(app);
    appsByRequest.set(app.businessRequestId, list);
  }

  type TableRow = {
    id: string;
    title: string;
    meta: string;
    budget: string;
    status: string;
    responseLabel: string;
    updated: string;
    creators: string[];
    href: string;
  };

  const tableRows: TableRow[] = [
    ...recentBriefs.map((brief) => ({
      id: brief.id,
      title: brief.title,
      meta: [brief.specialty ? specialtyLabel(brief.specialty) : "", brief.platform, brief.collabType]
        .filter(Boolean)
        .join(" · "),
      budget: brief.budget ? `${brief.budgetCurrency || "USD"} ${brief.budget}` : "—",
      status: brief.status,
      responseLabel: "—",
      updated: relativeTime(brief.createdAt),
      creators: [] as string[],
      href: `/collaboration/business?intent=${encodeURIComponent(brief.id)}`,
    })),
    ...marketplaceRequests.slice(0, 5).map((request) => {
      const apps = appsByRequest.get(request.id) ?? [];
      const creatorSlugs = [...new Set(apps.map((app) => app.creatorSlug).filter(Boolean))] as string[];
      return {
        id: request.id,
        title: request.brand,
        meta: [request.category, ...request.tags.slice(0, 2)].filter(Boolean).join(" · "),
        budget: request.budget || "—",
        status: request.status || "open",
        responseLabel: apps.length ? `${apps.length}` : "0",
        updated: "—",
        creators: creatorSlugs.slice(0, 4),
        href: "/collaboration/business#requests",
      };
    }),
  ].slice(0, 5);

  const activity = [
    ...applications.slice(0, 4).map((app) => ({
      id: `app-${app.id}`,
      title: app.creatorSlug
        ? `${app.creatorSlug} ${app.status === "RESPONDED" ? "responded to your request" : `application ${app.status.toLowerCase()}`}`
        : `Application ${app.status.toLowerCase()}`,
      detail: app.requestBrand || app.opportunityLookingFor || "Collaboration request",
      when: relativeTime(app.createdAt),
      initial: (app.creatorSlug || "A").slice(0, 1).toUpperCase(),
    })),
    ...(hub?.pipeline ?? []).slice(0, 3).map((item) => ({
      id: `pipe-${item.id}`,
      title: item.stage === "Review" ? "Content delivered for review" : `${item.stage} collaboration`,
      detail: `${item.title} · ${item.counterparty}`,
      when: "Recently",
      initial: item.counterparty.slice(0, 1).toUpperCase(),
    })),
    ...workspace.inquiries.slice(0, 3).map((inquiry) => ({
      id: `inq-${inquiry.id}`,
      title: `Lead update · ${inquiry.creatorSlug}`,
      detail: inquiry.message.slice(0, 80) || inquiry.status,
      when: relativeTime(inquiry.createdAt),
      initial: inquiry.creatorSlug.slice(0, 1).toUpperCase(),
    })),
  ].slice(0, 5);

  const ownerLabel = contactName || account.email;
  const planActive = Boolean(subscription?.status === "active" || workspace.plan);

  const signedContracts = contracts.filter((row) => row.status === "signed");
  const pendingContracts = contracts.filter((row) => {
    const yours = row.parties.find(
      (party) =>
        party.userId === account.id || party.email.trim().toLowerCase() === account.email.trim().toLowerCase(),
    );
    return (
      row.signingChannel === "native" &&
      (row.status === "sent" || row.status === "draft") &&
      yours?.status === "pending"
    );
  });
  await syncAccountNotices(
    account.id,
    businessAttentionDrafts({
      pendingResponses,
      contracts: pendingContracts.map((contract) => ({ id: contract.id, title: contract.title })),
      funding: (hub?.pipeline ?? [])
        .filter((item) => item.awaitingFunding)
        .map((item) => ({ id: item.id, title: item.title, href: item.contractHref || "/payments" })),
      reviews: (hub?.pipeline ?? [])
        .filter((item) => item.stage === "Review")
        .map((item) => ({ id: item.id, title: item.title, counterparty: item.counterparty, href: item.href })),
    }),
  ).catch(() => undefined);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold text-indigo">Welcome back, {greetName}.</h1>
        <p className="mt-1 text-sm text-muted">
          Here&apos;s what needs a decision for{" "}
          <span className="font-semibold text-indigo">{companyName}</span>.
        </p>
      </div>

      <Panel
        title="Contracts"
        action={<TextLink href="/collaboration/contracts">View all →</TextLink>}
      >
        {contractLoad.incident ? (
          <UnavailableNote label="Contracts" incident={contractLoad.incident} href="/business/home" />
        ) : contracts.length === 0 ? (
          <p className="text-sm text-muted">No contracts yet. Sent agreements appear here for every party.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {[...pendingContracts, ...signedContracts, ...contracts.filter((c) => !pendingContracts.includes(c) && !signedContracts.includes(c))]
              .slice(0, 5)
              .map((contract) => {
                const progress = contractPartyProgress(contract.parties);
                const needsSign = pendingContracts.some((row) => row.id === contract.id);
                return (
                  <li key={contract.id}>
                    <Link
                      href={`/collaboration/contracts/${contract.id}${needsSign ? "#sign" : ""}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F7F8FC] px-3 py-2 hover:bg-[#F1ECFF]"
                    >
                      <span>
                        <span className="font-semibold text-indigo">{contract.title}</span>
                        <span className="ml-2 text-xs text-muted">
                          {contract.status} · {progress.label}
                        </span>
                      </span>
                      <span className="text-xs font-semibold text-violet">
                        {needsSign ? "Sign now →" : "Open →"}
                      </span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        )}
      </Panel>

      <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-4 shadow-sm sm:p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Needs your attention</h2>
        {hubResult.incident || fundingsUnavailable ? (
          <div className="mt-3">
            <UnavailableNote
              label="Funding tasks"
              incident={hubResult.incident || hub?.incidents.fundings || "inc-unknown"}
              href="/business/home"
            />
          </div>
        ) : null}
        {pendingResponses === 0 && pendingContracts.length === 0 && (fundingsUnavailable || (hub?.pipeline.filter((item) => item.awaitingFunding || item.stage === "Review").length ?? 0) === 0) ? (
          fundingsUnavailable || hubResult.incident ? null : (
            <p className="mt-3 text-sm text-muted">Nothing is waiting on you. New responses, signatures, and funding tasks appear here.</p>
          )
        ) : (
          <ul className="mt-3 divide-y divide-[#EEF2F7]">
            {pendingResponses > 0 ? (
              <li className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-indigo">{pendingResponses} response{pendingResponses === 1 ? "" : "s"} to review</p>
                  <p className="text-xs text-muted">Influencers have responded to your invites.</p>
                </div>
                <Link href="/collaboration/business" className="rounded-full bg-[#6D4AFF] px-3 py-2 text-xs font-semibold text-white">Review</Link>
              </li>
            ) : null}
            {pendingContracts.slice(0, 3).map((contract) => (
              <li key={contract.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-indigo">1 agreement to sign</p>
                  <p className="text-xs text-muted">{contract.title} is ready for your signature.</p>
                </div>
                <Link href={`/collaboration/contracts?open=${contract.id}`} className="rounded-full bg-[#6D4AFF] px-3 py-2 text-xs font-semibold text-white">Review</Link>
              </li>
            ))}
            {(hub?.pipeline ?? []).filter((item) => item.awaitingFunding).slice(0, 2).map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-indigo">1 collaboration to fund</p>
                  <p className="text-xs text-muted">{item.title} needs funding before work starts.</p>
                </div>
                <Link href={item.contractHref || "/payments"} className="rounded-full bg-[#6D4AFF] px-3 py-2 text-xs font-semibold text-white">Review</Link>
              </li>
            ))}
            {(hub?.pipeline ?? []).filter((item) => item.stage === "Review").slice(0, 2).map((item) => (
              <li key={`review-${item.id}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-semibold text-indigo">Review a submission</p>
                  <p className="text-xs text-muted">{item.title} · {item.counterparty}</p>
                </div>
                <Link href={item.href} className="rounded-full bg-[#6D4AFF] px-3 py-2 text-xs font-semibold text-white">Review</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border border-[#E6ECF7] bg-white p-5 shadow-sm sm:p-6">
        {setupPercent === 100 ? (
          <p className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-emerald-700">
            <span>Account ready. Profile, plan, and workspace details are set.</span>
            <Link href="/business/profile" className="text-[#6D4AFF]">Edit profile</Link>
          </p>
        ) : null}
        <div className={`${setupPercent === 100 ? "hidden" : "flex"} flex-wrap items-start gap-5`}>
          <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5B8CFF] to-[#6D5EF7] text-2xl font-bold text-white shadow-sm">
            {companyName.slice(0, 1).toUpperCase()}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-bold text-indigo">{companyName}</h2>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  trust.profile === "Profile complete" ? "bg-emerald-50 text-emerald-700" : "bg-[#EEF2FA] text-muted"
                }`}
              >
                {trust.profile}
              </span>
              {trust.showVerifiedBadge ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  <IconVerified size={12} /> {trust.verification}
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                  {trust.verification}
                </span>
              )}
              {trust.showVerifiedBadge ? null : (
                <Link href="/account/verification" className="text-xs font-semibold text-violet hover:underline">
                  Complete verification
                </Link>
              )}
            </div>
            {profileLoad.incident ? (
              <div className="mt-3">
                <UnavailableNote label="Profile" incident={profileLoad.incident} href="/business/home" />
              </div>
            ) : null}
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#4E5872]">{bio}</p>

            <div className="mt-4 flex flex-wrap items-end gap-4">
              <div className="min-w-[14rem] flex-1">
                <div className="flex items-center justify-between text-xs font-semibold text-indigo">
                  <span>Profile Completion</span>
                  <span>{setupPercent}%</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#EEF2FA]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#5B8CFF] to-[#6D5EF7]"
                    style={{ width: `${setupPercent}%` }}
                  />
                </div>
                {setupPercent < 100 ? (
                  <Link href="/business/profile" className="mt-2 inline-block text-xs font-semibold text-violet hover:underline">
                    Complete your profile →
                  </Link>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-emerald-700">Company profile ready</p>
                )}
              </div>

              <div className="inline-flex items-center gap-2 rounded-2xl border border-[#E6ECF7] bg-[#F8F6FF] px-3.5 py-2.5">
                <IconStar size={16} className="text-violet" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-violet">Current Plan</p>
                  <p className="text-sm font-bold text-indigo">{planBadgeLabel}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[11.5rem]">
            <Link href="/business/profile" className="btn-secondary !py-2.5 text-center text-sm">
              Edit Company Profile
            </Link>
            <Link href="/collaboration/business?intent=new" className="btn-primary !py-2.5 text-center text-sm">
              <span className="inline-flex items-center justify-center gap-1">
                <IconPlus size={14} /> Create Request
              </span>
            </Link>
            <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 sm:flex-col sm:items-center">
              <Link href="/discover" className="text-sm font-semibold text-violet hover:underline">
                Discover Creators
              </Link>
              <Link href="/collaboration/team" className="text-sm font-semibold text-violet hover:underline">
                Invite Team
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Link href="/collaboration/business?tab=requests&filter=open" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet">
          <StatCard
            label="Active Requests"
            value={activeRequests === null ? "—" : String(activeRequests)}
            note={requestsUnavailable ? "Requests could not be loaded. This is not zero." : `${pendingResponses} pending responses`}
            tone="violet"
            icon={<IconFileText size={16} />}
          />
        </Link>
        <Link href="#shortlist" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet">
          <StatCard
            label="Saved Creators"
            value={String(workspace.shortlist.length)}
            note="On this workspace shortlist"
            tone="blue"
            icon={<IconBookmark size={16} />}
          />
        </Link>
        <Link href="/collaboration/records?scope=active" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet">
          <StatCard
            label="Active Collaborations"
            value={activeCollabs === null ? "—" : String(activeCollabs)}
            note={
              fundingsUnavailable
                ? "Collaborations could not be loaded. This is not zero."
                : `${contentInReview ?? 0} content in review · Open inbox →`
            }
            tone="emerald"
            icon={<IconUsers size={16} />}
          />
        </Link>
        <Link href="/payments" className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet">
          <StatCard
            label="Funded this month"
            value={periodFunding ? periodFunding.value : "—"}
            note={
              periodFunding
                ? periodFunding.note
                : `Funding could not be loaded. This is not zero. Reference ${monthly.ok ? "" : monthly.incident}`
            }
            tone="emerald"
            icon={<IconWallet size={16} />}
          />
        </Link>
        <StatCard
          label="Response Rate"
          value={applicationsUnavailable || responseRate === null ? "—" : `${responseRate}%`}
          note={
            applicationsUnavailable
              ? "Applications could not be loaded. This is not zero."
              : responseRate === null
                ? "Appears after creators apply to your requests"
                : "Across applications on your requests"
          }
          tone="amber"
          icon={<IconIntelligence size={16} />}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(17.5rem,0.75fr)]">
        <div className="space-y-4">
          <Panel
            title="Active work"
            action={<TextLink href="/business/campaigns">View all requests →</TextLink>}
          >
            {requestsUnavailable && tableRows.length === 0 ? (
              <UnavailableNote label="Requests" incident={hubResult.incident || hub?.incidents.requests || "inc-unknown"} href="/business/home" />
            ) : tableRows.length === 0 ? (
              <p className="text-sm text-muted">
                No published requests yet.{" "}
                <Link href="/collaboration/business?intent=new" className="font-semibold text-violet hover:underline">
                  Create one
                </Link>
                .
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-muted">
                    <tr>
                      <th className="pb-3 pr-3 font-semibold">Request</th>
                      <th className="pb-3 pr-3 font-semibold">Creators</th>
                      <th className="pb-3 pr-3 font-semibold">Budget</th>
                      <th className="pb-3 pr-3 font-semibold">Status</th>
                      <th className="pb-3 pr-3 font-semibold">Responses</th>
                      <th className="pb-3 font-semibold">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => (
                      <tr key={row.id} className="border-t border-[#F0F3FA]">
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FA] text-sm font-bold text-violet">
                              {row.title.slice(0, 1).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <Link
                                href={row.href}
                                className="truncate font-semibold text-indigo hover:text-violet hover:underline"
                              >
                                {row.title}
                              </Link>
                              <p className="truncate text-xs text-muted">{row.meta || "Campaign"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          {row.creators.length === 0 ? (
                            <span className="text-xs text-muted">—</span>
                          ) : (
                            <div className="flex -space-x-2">
                              {row.creators.map((slug) => (
                                <span
                                  key={slug}
                                  title={slug}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#EDE7FF] text-[10px] font-bold text-violet"
                                >
                                  {slug.slice(0, 1).toUpperCase()}
                                </span>
                              ))}
                              {Number(row.responseLabel) > row.creators.length ? (
                                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#EEF2FA] text-[10px] font-bold text-muted">
                                  +{Number(row.responseLabel) - row.creators.length}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="py-3 pr-3 font-semibold">{row.budget}</td>
                        <td className="py-3 pr-3">
                          <StatusPill tone={requestStatusTone(row.status)}>{requestStatusLabel(row.status)}</StatusPill>
                        </td>
                        <td className="py-3 pr-3 text-muted">{row.responseLabel}</td>
                        <td className="py-3 text-muted">{row.updated}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {draftBriefs.length > 0 ? (
            <Panel
              title={`Drafts (${draftBriefs.length})`}
              action={<TextLink href="/business/campaigns">Manage drafts →</TextLink>}
            >
              <ul className="divide-y divide-[#EEF2FA]">
                {draftBriefs.map((brief) => (
                  <li key={brief.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-indigo">{brief.title || "Untitled draft"}</p>
                      <p className="text-xs text-muted">Saved draft — open to continue</p>
                    </div>
                    <Link
                      href={`/collaboration/business?intent=${encodeURIComponent(brief.id)}`}
                      className="shrink-0 text-xs font-bold text-violet hover:underline"
                    >
                      Open →
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel title="Suggested Creators for You" action={<TextLink href="/discover">View more creators →</TextLink>}>
            {hubResult.incident ? (
              <UnavailableNote label="Suggestions" incident={hubResult.incident} href="/business/home" />
            ) : suggestions.length === 0 ? (
              <p className="text-sm text-muted">
                Suggestions appear after you save a brief. This list does not invent creators.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {suggestions.slice(0, 4).map((fit) => {
                  const followers = syncedFollowerTotal(fit.creator.socials);
                  const platforms = [...new Set(fit.creator.socials.map((social) => social.platform))].slice(0, 3);
                  return (
                    <div key={fit.creator.slug} className="overflow-hidden rounded-2xl border border-[#F0F3FA] bg-white">
                      <div className="aspect-[4/3] overflow-hidden bg-[#EEF2FA]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={fit.creator.image} alt="" className="h-full w-full object-cover" />
                      </div>
                      <div className="p-3">
                        <div className="flex items-center gap-1">
                          <p className="truncate text-sm font-bold">{fit.creator.displayName}</p>
                          {fit.creator.verified ? <IconVerified size={14} /> : null}
                        </div>
                        <p className="text-xs text-muted">@{fit.creator.slug}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {fit.creator.specialties.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-[#EEF2FA] px-2 py-0.5 text-[10px] font-semibold text-muted"
                            >
                              {specialtyLabel(tag)}
                            </span>
                          ))}
                        </div>
                        {platforms.length > 0 ? (
                          <div className="mt-2 flex items-center gap-1.5 text-violet">
                            {platforms.map((platform) => (
                              <SocialIcon key={platform} platform={platform} size={14} />
                            ))}
                          </div>
                        ) : null}
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
                          <span>
                            <span className="block font-semibold text-indigo">{formatFollowers(followers)}</span>
                            Followers
                          </span>
                          <span>
                            <span className="block font-semibold text-indigo">
                              {fit.creator.stats?.engagementRate || "—"}
                            </span>
                            Engagement
                          </span>
                        </div>
                        <Link
                          href="/collaboration/business#shortlist"
                          className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-[#F1ECFF] px-3 py-2 text-xs font-bold text-violet hover:bg-[#E8E0FF]"
                        >
                          Add to Shortlist
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Team Members" action={<TextLink href="/collaboration/team">Manage Team</TextLink>}>
            <div className="mb-3 text-xs font-semibold text-muted">
              {seatsUsed === null || teamSeats === null ? (
                <UnavailableNote label="Team seats" incident={seats.ok ? hubResult.incident || "inc-unknown" : seats.incident} href="/business/home" />
              ) : (
                `${seatsUsed} of ${teamSeats} seat${teamSeats === 1 ? "" : "s"} used`
              )}
            </div>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#EDE7FF] text-sm font-bold text-violet">
                  {ownerLabel.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <span className="block text-sm font-semibold">{ownerLabel}</span>
                  <span className="text-xs text-muted">Owner</span>
                </span>
              </li>
              {seats.ok
                ? seats.members.map((member) => (
                    <li key={member.email} className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#EDE7FF] text-sm font-bold text-violet">
                        {member.email.slice(0, 1).toUpperCase()}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">{member.email}</span>
                        <span className="text-xs capitalize text-muted">{member.role}</span>
                      </span>
                    </li>
                  ))
                : null}
              {seatsUsed === null || teamSeats === null ? null : teamSeats > seatsUsed ? (
                <li>
                  <Link
                    href="/collaboration/team"
                    className="flex items-center gap-3 rounded-xl border border-dashed border-[#C9D3EA] px-2 py-2 hover:bg-[#F7F8FC]"
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#F1ECFF] text-violet">
                      <IconPlus size={16} />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">Invite Member</span>
                      <span className="text-xs text-muted">
                        {teamSeats - seatsUsed} seat{teamSeats - seatsUsed === 1 ? "" : "s"} open
                      </span>
                    </span>
                  </Link>
                </li>
              ) : (
                <li className="text-xs text-muted">Upgrade for more seats from Billing & Plans.</li>
              )}
            </ul>
          </Panel>

          <div id="shortlist">
          <Panel title="Saved creators" action={<TextLink href="/discover">Find creators →</TextLink>}>
            {workspace.shortlist.length === 0 ? (
              <p className="text-sm text-muted">No saved creators yet. This is not a failed load.</p>
            ) : (
              <ul className="space-y-2">
                {workspace.shortlist.map((item) => (
                  <li key={item.creatorSlug}>
                    <Link href={`/creators/${item.creatorSlug}`} className="text-sm font-semibold text-indigo hover:text-violet hover:underline">
                      {item.creatorSlug}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted">{workspace.shortlist.length} saved creator{workspace.shortlist.length === 1 ? "" : "s"}</p>
          </Panel>
          </div>

          <Panel title="Billing & Subscription" action={<TextLink href="/business/billing">Manage plan →</TextLink>}>
            {subscriptionLoad.incident ? (
              <UnavailableNote label="Subscription" incident={subscriptionLoad.incident} href="/business/home" />
            ) : null}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-indigo">{planName}</p>
                <p className="mt-0.5 text-sm text-muted">{planPriceDisplay ?? "Free"}</p>
              </div>
              {planActive ? <StatusPill tone="success">Active</StatusPill> : <StatusPill tone="neutral">Free</StatusPill>}
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Workspace plan</dt>
                <dd className="font-semibold text-indigo">{planName}</dd>
              </div>
              {subscription?.status ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Subscription</dt>
                  <dd className="font-semibold capitalize text-indigo">{subscription.status}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Billing</dt>
                <dd className="font-semibold text-indigo">
                  <Link href="/business/billing" className="text-violet hover:underline">
                    Open billing
                  </Link>
                </dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Recent Activity" action={<TextLink href="/collaboration/business">View all activity →</TextLink>}>
            {hubResult.incident && activity.length === 0 ? (
              <UnavailableNote label="Recent activity" incident={hubResult.incident} href="/business/home" />
            ) : activity.length === 0 ? (
              <p className="text-sm text-muted">
                Activity from requests, applications, and collaborations will show here.
              </p>
            ) : (
              <ul className="space-y-4">
                {activity.map((item) => (
                  <li key={item.id} className="flex gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EDE7FF] text-xs font-bold text-violet">
                      {item.initial}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-indigo">{item.title}</p>
                      <p className="truncate text-xs text-muted">{item.detail}</p>
                      <p className="mt-0.5 text-[11px] text-muted">{item.when}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </section>
    </div>
  );
}
