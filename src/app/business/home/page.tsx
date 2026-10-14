import Link from "next/link";
import { redirect } from "next/navigation";
import { Panel, StatCard, StatusPill, TextLink } from "@/components/dashboard-ui";
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
import { getWorkspace } from "@/lib/business";
import { loadBusinessHub } from "@/lib/collaboration-hub";
import { formatMoney } from "@/lib/money";
import { loadPlanMatrix } from "@/lib/plan-matrix";
import { formatFollowers, specialtyLabel } from "@/lib/seed-data";

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

export default async function BusinessHomePage() {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/business/home");
  const [workspace, matrix, hub] = await Promise.all([
    getWorkspace(account.id).catch(() => null),
    loadPlanMatrix("business"),
    loadBusinessHub({ userId: account.id }).catch(() => null),
  ]);
  if (!workspace) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold">Business account</h1>
        <p className="mt-2 text-sm text-muted">Workspace details are unavailable right now.</p>
      </div>
    );
  }

  const entitlements = hub?.entitlements ?? null;
  const planColumn = matrix.plans.find((plan) => plan.code === workspace.plan);
  const planName = planColumn?.name ?? workspace.plan;
  const planPrice = planColumn?.priceLabel || "Free";
  const checks = [
    { label: "Company name", done: Boolean(workspace.name.trim()) },
    { label: "Industry", done: Boolean(workspace.industry.trim()) },
    { label: "A brief / request", done: workspace.briefs.length > 0 },
    { label: "A saved creator", done: workspace.shortlist.length > 0 },
  ];
  const complete = checks.filter((item) => item.done).length;
  const setupPercent = Math.round((complete / checks.length) * 100);
  const recentBriefs = [...workspace.briefs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const marketplaceRequests = hub?.ownRequests ?? [];
  const suggestions = hub?.suggestions ?? [];
  const applications = hub?.applications ?? [];
  const spend = hub?.spend;
  const activeRequests = hub?.status.active ?? workspace.briefs.filter((b) => b.status === "active").length;
  const pendingResponses = hub?.status.pendingReview ?? 0;
  const activeCollabs = hub?.pipeline.filter((item) => item.stage !== "Released").length ?? 0;
  const contentInReview = hub?.pipeline.filter((item) => item.stage === "Review").length ?? 0;
  const monthlySpend = spend ? formatMoney(spend.fundedCents, spend.currency || "USD") : "$0";
  const teamSeats = entitlements?.teamSeats ?? 1;
  const seatsUsed = Math.min(1, teamSeats);
  const firstName = (account.name || "").split(" ")[0];
  const verifiedBusiness = Boolean(workspace.name.trim() && workspace.industry.trim());
  const bio =
    workspace.industry.trim()
      ? `${workspace.name || "This workspace"} works in ${workspace.industry}. Discover creators, publish requests, and manage collaborations from one place.`
      : "Add your industry and company details so creators know who they are working with.";

  const responded = applications.filter((app) =>
    ["RESPONDED", "NEGOTIATING", "ACCEPTED", "COLLABORATION_DRAFTED"].includes(app.status),
  ).length;
  const responseRate =
    applications.length > 0 ? Math.round((responded / applications.length) * 100) : null;

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
  };

  const tableRows: TableRow[] = [
    ...recentBriefs.map((brief) => ({
      id: brief.id,
      title: brief.title,
      meta: [brief.specialty ? specialtyLabel(brief.specialty) : "", brief.platform]
        .filter(Boolean)
        .join(" · "),
      budget: brief.budget || "—",
      status: brief.status,
      responseLabel: "—",
      updated: relativeTime(brief.createdAt),
      creators: [] as string[],
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold text-indigo">Business Account</h1>
        <p className="mt-1 text-sm text-muted">
          Welcome back{firstName ? `, ${firstName}` : ""}. Here&apos;s what&apos;s happening with{" "}
          {workspace.name || "your workspace"}.
        </p>
      </div>

      <section className="rounded-3xl border border-[#E6ECF7] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-5">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5B8CFF] to-[#6D5EF7] text-2xl font-bold text-white shadow-sm">
            {(workspace.name || "B").slice(0, 1).toUpperCase()}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-bold">{workspace.name || "Untitled workspace"}</h2>
              {verifiedBusiness ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  <IconVerified size={12} /> Verified Business
                </span>
              ) : (
                <span className="rounded-full bg-[#EEF2FA] px-2.5 py-1 text-[11px] font-semibold text-muted">
                  Profile incomplete
                </span>
              )}
            </div>
            <p className="mt-2 max-w-2xl text-sm text-indigo/80">{bio}</p>

            <div className="mt-4 flex flex-wrap gap-4">
              <div className="min-w-[12rem] flex-1 rounded-2xl bg-[#F7F8FC] p-3">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Profile Completion</span>
                  <span>{setupPercent}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white">
                  <div className="h-2 rounded-full bg-[#5B8CFF]" style={{ width: `${setupPercent}%` }} />
                </div>
                {setupPercent < 100 ? (
                  <Link href="/business/profile" className="mt-2 inline-block text-xs font-semibold text-violet hover:underline">
                    Complete your profile →
                  </Link>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-emerald-700">Company profile ready</p>
                )}
              </div>

              <div className="rounded-2xl border border-[#E6ECF7] bg-[#F8F6FF] px-4 py-3 sm:min-w-[10rem]">
                <p className="text-xs font-bold uppercase tracking-wide text-violet">Current Plan</p>
                <div className="mt-1 flex items-center gap-2">
                  <IconStar size={16} className="text-violet" />
                  <p className="font-display text-lg font-bold">{planName}</p>
                </div>
                <p className="text-sm text-muted">
                  {planPrice}
                  {planPrice !== "Free" && !planPrice.includes("/") ? " / month" : ""}
                </p>
              </div>
            </div>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 sm:w-[18rem] sm:grid-cols-2">
            <Link href="/business/profile" className="btn-secondary !py-2.5 text-center text-sm">
              Edit Company Profile
            </Link>
            <Link href="/collaboration/business" className="btn-primary !py-2.5 text-center text-sm">
              <span className="inline-flex items-center justify-center gap-1">
                <IconPlus size={14} /> Create Request
              </span>
            </Link>
            <Link href="/discover" className="btn-secondary !py-2.5 text-center text-sm">
              Discover Creators
            </Link>
            <Link href="/collaboration/team" className="btn-secondary !py-2.5 text-center text-sm">
              Invite Team
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Active Requests"
          value={String(activeRequests)}
          note={`${pendingResponses} pending responses`}
          tone="violet"
          icon={<IconFileText size={16} />}
        />
        <StatCard
          label="Saved Creators"
          value={String(workspace.shortlist.length)}
          note="On this workspace shortlist"
          tone="blue"
          icon={<IconBookmark size={16} />}
        />
        <StatCard
          label="Active Collaborations"
          value={String(activeCollabs)}
          note={`${contentInReview} content in review`}
          tone="emerald"
          icon={<IconUsers size={16} />}
        />
        <StatCard
          label="Monthly Spend"
          value={monthlySpend}
          note="Funded collaboration totals"
          tone="emerald"
          icon={<IconWallet size={16} />}
        />
        <StatCard
          label="Response Rate"
          value={responseRate === null ? "—" : `${responseRate}%`}
          note={
            responseRate === null
              ? "Appears after creators apply to your requests"
              : "Across applications on your requests"
          }
          tone="amber"
          icon={<IconIntelligence size={16} />}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.8fr)]">
        <Panel
          title="Recent Collaboration Requests"
          action={<TextLink href="/collaboration/business">View all requests →</TextLink>}
        >
          {tableRows.length === 0 ? (
            <p className="text-sm text-muted">No requests yet. Create one from the collaboration hub.</p>
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
                            <p className="truncate font-semibold text-indigo">{row.title}</p>
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

        <div className="space-y-4">
          <Panel title="Team Members" action={<TextLink href="/collaboration/team">Manage Team</TextLink>}>
            <p className="mb-3 text-xs font-semibold text-muted">
              {seatsUsed} of {teamSeats} seat{teamSeats === 1 ? "" : "s"} used
            </p>
            <ul className="space-y-3">
              <li className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#EDE7FF] text-sm font-bold text-violet">
                  {(account.name || account.email || "U").slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <span className="block text-sm font-semibold">{account.name || account.email}</span>
                  <span className="text-xs text-muted">Owner</span>
                </span>
              </li>
              {teamSeats > 1 ? (
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
                      <span className="text-xs text-muted">{teamSeats - seatsUsed} seat{teamSeats - seatsUsed === 1 ? "" : "s"} open</span>
                    </span>
                  </Link>
                </li>
              ) : (
                <li className="text-xs text-muted">
                  Upgrade for more seats. Team proposals invite creators onto a shared deal.
                </li>
              )}
            </ul>
          </Panel>

          <Panel title="Plan">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted">
                Current plan: <span className="font-display text-base font-bold text-indigo">{planName}</span>
              </p>
              <Link href="/business/billing" className="text-xs font-bold text-violet hover:underline">
                Manage plan →
              </Link>
            </div>
          </Panel>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.8fr)]">
        <Panel title="Suggested Creators for You" action={<TextLink href="/discover">Discover more →</TextLink>}>
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted">
              Suggestions appear after you save a brief. This list does not invent creators.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {suggestions.slice(0, 4).map((fit) => {
                const followers = fit.creator.socials.reduce((sum, social) => sum + (social.followers || 0), 0);
                const primarySocial = fit.creator.socials[0];
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
                          <span key={tag} className="rounded-full bg-[#EEF2FA] px-2 py-0.5 text-[10px] font-semibold text-muted">
                            {specialtyLabel(tag)}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted">
                        <span>
                          <span className="font-semibold text-indigo">{formatFollowers(followers)}</span> followers
                        </span>
                        {primarySocial ? (
                          <span className="text-violet">
                            <SocialIcon platform={primarySocial.platform} size={14} />
                          </span>
                        ) : null}
                      </div>
                      {fit.creator.stats?.engagementRate ? (
                        <p className="mt-1 text-xs text-muted">
                          Engagement <span className="font-semibold text-indigo">{fit.creator.stats.engagementRate}</span>
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted">Fit score {fit.score}</p>
                      )}
                      <Link
                        href="/collaboration/business#shortlist"
                        className="btn-secondary mt-3 !w-full !py-2 text-center text-xs"
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

        <Panel title="Recent Activity" action={<TextLink href="/collaboration/business">View all activity →</TextLink>}>
          {activity.length === 0 ? (
            <p className="text-sm text-muted">Activity from requests, applications, and collaborations will show here.</p>
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
      </section>
    </div>
  );
}
