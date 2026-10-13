import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";
import { loadBusinessHub } from "@/lib/collaboration-hub";
import { formatMoney } from "@/lib/money";
import { loadPlanMatrix } from "@/lib/plan-matrix";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business account" };

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
  const planName = matrix.plans.find((plan) => plan.code === workspace.plan)?.name ?? workspace.plan;
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
  const spend = hub?.spend;
  const activeRequests = hub?.status.active ?? workspace.briefs.filter((b) => b.status === "active").length;
  const pendingResponses = hub?.status.pendingReview ?? 0;
  const activeCollabs = hub?.pipeline.filter((item) => item.stage !== "Released").length ?? 0;
  const monthlySpend = spend ? formatMoney(spend.fundedCents, spend.currency || "USD") : "$0";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-bold">Business account</h1>
        <p className="mt-1 text-sm text-muted">
          Welcome back{account.name ? `, ${account.name.split(" ")[0]}` : ""}. Here&apos;s what&apos;s happening with{" "}
          {workspace.name || "your workspace"}.
        </p>
      </div>

      {setupPercent < 100 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <div>
            <p className="font-semibold">Complete your company profile ({setupPercent}%)</p>
            <p className="text-amber-900/80">Finish setup so creators and team members see a complete workspace.</p>
          </div>
          <Link href="/business/profile" className="btn-primary !py-2 text-sm">
            Complete profile →
          </Link>
        </div>
      ) : null}

      <section className="rounded-3xl border border-[#E6ECF7] bg-white p-5">
        <div className="flex flex-wrap items-start gap-4">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EDE7FF] text-2xl font-bold text-violet">
            {(workspace.name || "B").slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-bold">{workspace.name || "Untitled workspace"}</h2>
              {workspace.name.trim() && workspace.industry.trim() ? (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  Business profile ready
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted">{workspace.industry || "Industry not set"}</p>
            <div className="mt-4 max-w-md">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>Profile completion</span>
                <span>{setupPercent}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[#EEF2FA]">
                <div className="h-2 rounded-full bg-violet" style={{ width: `${setupPercent}%` }} />
              </div>
              {setupPercent < 100 ? (
                <Link href="/business/profile" className="mt-2 inline-block text-xs font-semibold text-violet hover:underline">
                  Complete your profile →
                </Link>
              ) : null}
            </div>
          </div>
          <div className="rounded-2xl border border-[#E6ECF7] bg-[#F8F6FF] px-4 py-3 text-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-violet">Current plan</p>
            <p className="mt-1 font-display text-lg font-bold">{planName}</p>
            <Link href="/business/billing" className="mt-1 inline-block text-xs font-semibold text-violet hover:underline">
              Manage plan
            </Link>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-48">
            <Link href="/business/profile" className="btn-secondary !py-2 text-center text-sm">
              Edit company profile
            </Link>
            <Link href="/collaboration/business" className="btn-primary !py-2 text-center text-sm">
              Create request
            </Link>
            <Link href="/discover" className="btn-secondary !py-2 text-center text-sm">
              Discover creators
            </Link>
            <Link href="/collaboration/team" className="btn-secondary !py-2 text-center text-sm">
              Invite team
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat
          label="Active requests"
          value={String(activeRequests)}
          note={`${pendingResponses} pending responses`}
        />
        <Stat
          label="Saved creators"
          value={String(workspace.shortlist.length)}
          note="On this workspace shortlist"
        />
        <Stat
          label="Active collaborations"
          value={String(activeCollabs)}
          note="Funded or in-progress deals"
        />
        <Stat label="Monthly spend" value={monthlySpend} note="Funded collaboration totals" />
        <Stat
          label="Team seats"
          value={entitlements ? String(entitlements.teamSeats) : "—"}
          note="Plan seat quota (roster management ships separately)"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.85fr)]">
        <div className="overflow-hidden rounded-3xl border border-[#E6ECF7] bg-white">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="font-display text-lg font-bold">Recent collaboration requests</h2>
            <Link href="/collaboration/business" className="text-xs font-semibold text-violet">
              View requests
            </Link>
          </div>
          {recentBriefs.length === 0 && marketplaceRequests.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-muted">No requests yet. Start one from the collaboration hub.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-2 font-semibold">Request</th>
                    <th className="px-3 py-2 font-semibold">Budget</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBriefs.map((brief) => (
                    <tr key={brief.id} className="border-t border-[#F0F3FA]">
                      <td className="px-5 py-3">
                        <p className="font-semibold">{brief.title}</p>
                        <p className="text-xs text-muted">{brief.specialty}</p>
                      </td>
                      <td className="px-3 py-3">{brief.budget || "—"}</td>
                      <td className="px-3 py-3 capitalize">{brief.status}</td>
                      <td className="px-3 py-3">{brief.createdAt.slice(0, 10)}</td>
                    </tr>
                  ))}
                  {marketplaceRequests.slice(0, 4).map((request) => (
                    <tr key={request.id} className="border-t border-[#F0F3FA]">
                      <td className="px-5 py-3">
                        <p className="font-semibold">{request.brand}</p>
                        <p className="text-xs text-muted">{request.category}</p>
                      </td>
                      <td className="px-3 py-3">{request.budget || "—"}</td>
                      <td className="px-3 py-3 capitalize">{request.status}</td>
                      <td className="px-3 py-3">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Team seats</h2>
              <Link href="/collaboration/team" className="text-xs font-semibold text-violet">
                Manage team
              </Link>
            </div>
            <p className="mt-2 text-sm text-muted">
              {entitlements
                ? `${entitlements.teamSeats} seat${entitlements.teamSeats === 1 ? "" : "s"} on ${planName}. Seat invites are opened from Team proposals.`
                : "Plan seats load with the workspace."}
            </p>
          </div>
          <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5">
            <h2 className="font-display text-lg font-bold">Billing & subscription</h2>
            <p className="mt-2 font-display text-xl font-bold">{planName}</p>
            <p className="mt-1 text-sm text-muted">Manage invoices and plan changes from billing.</p>
            <Link href="/business/billing" className="mt-3 inline-block text-sm font-semibold text-violet hover:underline">
              Open billing
            </Link>
          </div>
          <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5">
            <h2 className="font-display text-lg font-bold">Setup checklist</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {checks.map((item) => (
                <li key={item.label} className="flex gap-2">
                  <span className={item.done ? "text-emerald-600" : "text-muted"}>{item.done ? "✓" : "○"}</span>
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-[#E6ECF7] bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">Suggested creators for you</h2>
          <Link href="/discover" className="text-xs font-semibold text-violet">
            Discover more
          </Link>
        </div>
        {suggestions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Suggestions appear after you save a brief. This list does not invent creators.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {suggestions.slice(0, 4).map((fit) => (
              <div key={fit.creator.slug} className="rounded-2xl border border-[#F0F3FA] p-3">
                <p className="font-semibold">{fit.creator.displayName}</p>
                <p className="text-xs text-muted">@{fit.creator.slug}</p>
                <p className="mt-2 text-xs text-muted">
                  {fit.creator.specialties.slice(0, 2).join(" · ") || fit.creator.title}
                </p>
                <p className="mt-2 text-xs font-semibold text-violet">Fit score {fit.score}</p>
                <div className="mt-3 flex gap-2">
                  <Link href={`/creators/${fit.creator.slug}`} className="btn-secondary !py-1.5 text-xs">
                    View
                  </Link>
                  <Link
                    href="/collaboration/business#shortlist"
                    className="btn-secondary !py-1.5 text-xs"
                  >
                    Shortlist
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-[#E6ECF7] bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Saved creators</h2>
          <Link href="/collaboration/business#shortlist" className="text-xs font-semibold text-violet">
            Manage shortlist
          </Link>
        </div>
        {workspace.shortlist.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Save creators from Discover. This list does not invent suggestions.</p>
        ) : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {workspace.shortlist.slice(0, 6).map((item) => (
              <li key={item.creatorSlug} className="rounded-xl border border-[#F0F3FA] px-3 py-2 text-sm">
                <Link href={`/creators/${item.creatorSlug}`} className="font-semibold text-violet hover:underline">
                  {item.creatorSlug}
                </Link>
                {item.note ? <span className="mt-0.5 block text-xs text-muted">{item.note}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-3xl border border-[#E6ECF7] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}
