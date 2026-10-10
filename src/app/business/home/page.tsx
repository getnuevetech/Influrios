import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";
import { prisma } from "@/lib/db";
import { businessEntitlementsForPlan } from "@/lib/entitlements-db";
import { loadPlanMatrix } from "@/lib/plan-matrix";

export const dynamic = "force-dynamic";
export const metadata = { title: "Business account" };

export default async function BusinessHomePage() {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/business/home");
  const [workspace, matrix, fundings] = await Promise.all([
    getWorkspace(account.id).catch(() => null),
    loadPlanMatrix("business"),
    prisma.collaborationFunding
      .count({ where: { workspace: { ownerUserId: account.id } } })
      .catch(() => 0),
  ]);
  if (!workspace) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold">Business account</h1>
        <p className="mt-2 text-sm text-muted">Workspace details are unavailable right now.</p>
      </div>
    );
  }
  const entitlements = await businessEntitlementsForPlan(workspace.plan).catch(() => null);
  const planName = matrix.plans.find((plan) => plan.code === workspace.plan)?.name ?? workspace.plan;
  const checks = [
    { label: "Company name", done: Boolean(workspace.name.trim()) },
    { label: "Industry", done: Boolean(workspace.industry.trim()) },
    { label: "A brief", done: workspace.briefs.length > 0 },
    { label: "A saved creator", done: workspace.shortlist.length > 0 },
  ];
  const complete = checks.filter((item) => item.done).length;
  const recent = [...workspace.briefs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Business account</h1>
      <p className="mt-1 text-sm text-muted">
        Welcome back{account.name ? `, ${account.name.split(" ")[0]}` : ""}. This is {workspace.name || "your workspace"}.
      </p>

      <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_auto]">
        <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Workspace</p>
          {workspace.name ? <h2 className="mt-1 font-display text-2xl font-bold">{workspace.name}</h2> : null}
          <p className="mt-1 text-sm text-muted">{workspace.industry || "Industry not set"}</p>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span>Setup</span>
              <span>
                {complete} / {checks.length}
              </span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-[#EEF2FA]">
              <div className="h-2 rounded-full bg-violet" style={{ width: `${(complete / checks.length) * 100}%` }} />
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Current plan</p>
          <p className="mt-1 font-display text-2xl font-bold">{planName}</p>
          <p className="mt-1 text-sm text-muted">
            {entitlements ? `${entitlements.teamSeats} team ${entitlements.teamSeats === 1 ? "seat" : "seats"} on this plan.` : "Plan limits load with the workspace."}
          </p>
          <Link href="/business/billing" className="mt-3 inline-block text-sm font-semibold text-violet hover:underline">
            Manage plan
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          <Link href="/discover" className="btn-secondary !py-2 text-sm">Discover creators</Link>
          <Link href="/collaboration/business" className="btn-primary !py-2 text-sm">Open requests</Link>
        </div>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Briefs" value={String(workspace.briefs.length)} note="Briefs saved on this workspace." />
        <Stat label="Saved creators" value={String(workspace.shortlist.length)} note="Creators on the shortlist." />
        <Stat label="Inquiries" value={String(workspace.inquiries.length)} note="Inquiries sent from this workspace." />
        <Stat label="Collaborations" value={String(fundings)} note="Funding records owned by this workspace." />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-hidden rounded-3xl border border-[#E6ECF7] bg-white">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="font-display text-lg font-bold">Recent briefs</h2>
            <Link href="/collaboration/business" className="text-xs font-semibold text-violet">View requests</Link>
          </div>
          {recent.length === 0 ? <p className="px-5 pb-5 text-sm text-muted">No briefs yet. Start one from the collaboration hub.</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              {recent.length ? (
                <thead className="text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-5 py-2 font-semibold">Brief</th>
                    <th className="px-3 py-2 font-semibold">Budget</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 font-semibold">Inquiries</th>
                  </tr>
                </thead>
              ) : null}
              <tbody>
                {recent.map((brief) => (
                  <tr key={brief.id} className="border-t border-[#F0F3FA]">
                    <td className="px-5 py-3">
                      <p className="font-semibold">{brief.title}</p>
                      <p className="text-xs text-muted">{brief.specialty}</p>
                    </td>
                    <td className="px-3 py-3">{brief.budget || "—"}</td>
                    <td className="px-3 py-3 capitalize">{brief.status}</td>
                    <td className="px-3 py-3">{workspace.inquiries.filter((inquiry) => inquiry.briefId === brief.id).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5">
            <h2 className="font-display text-lg font-bold">Saved creators</h2>
            {workspace.shortlist.length === 0 ? <p className="mt-2 text-sm text-muted">Save creators from Discover. This list does not invent suggestions.</p> : null}
            <ul className="mt-3 space-y-2 text-sm">
              {workspace.shortlist.slice(0, 6).map((item) => (
                <li key={item.creatorSlug}>
                  <Link href={`/creators/${item.creatorSlug}`} className="font-semibold text-violet hover:underline">
                    {item.creatorSlug}
                  </Link>
                  {item.note ? <span className="mt-0.5 block text-xs text-muted">{item.note}</span> : null}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-[#E6ECF7] bg-white p-5">
            <h2 className="font-display text-lg font-bold">Setup</h2>
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
