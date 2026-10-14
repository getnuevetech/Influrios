import Link from "next/link";
import { redirect } from "next/navigation";
import { Panel, StatusPill, TextLink } from "@/components/dashboard-ui";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campaigns & drafts" };

function tone(status: string): "success" | "info" | "warn" | "neutral" | "violet" {
  const value = status.toLowerCase();
  if (value === "active" || value === "open" || value === "published") return "success";
  if (value === "draft") return "neutral";
  if (value.includes("review")) return "info";
  return "violet";
}

export default async function BusinessCampaignsPage() {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/business/campaigns");
  const workspace = await getWorkspace(account.id).catch(() => null);
  if (!workspace) {
    return (
      <div>
        <h1 className="font-display text-3xl font-bold">Campaigns & drafts</h1>
        <p className="mt-2 text-sm text-muted">Workspace details are unavailable right now.</p>
      </div>
    );
  }

  const briefs = [...workspace.briefs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const drafts = briefs.filter((brief) => brief.status === "draft");
  const active = briefs.filter((brief) => brief.status !== "draft");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-indigo">Campaigns & drafts</h1>
          <p className="mt-1 text-sm text-muted">
            Open a campaign to edit it. Drafts stay here until you publish — they are not expanded on the dashboard.
          </p>
        </div>
        <Link href="/collaboration/business?intent=new" className="btn-primary !py-2.5 text-sm">
          Create request
        </Link>
      </div>

      <Panel title={`Drafts (${drafts.length})`}>
        {drafts.length === 0 ? (
          <p className="text-sm text-muted">No drafts yet.</p>
        ) : (
          <ul className="divide-y divide-[#EEF2FA]">
            {drafts.map((brief) => (
              <li key={brief.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-indigo">{brief.title || "Untitled draft"}</p>
                  <p className="text-xs text-muted">
                    {[brief.collabType, brief.timeframe, brief.budget ? `${brief.budgetCurrency} ${brief.budget}` : ""]
                      .filter(Boolean)
                      .join(" · ") || "Draft campaign"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill tone="neutral">Draft</StatusPill>
                  <Link
                    href={`/collaboration/business?intent=${encodeURIComponent(brief.id)}`}
                    className="text-xs font-bold text-violet hover:underline"
                  >
                    Open →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title={`Published & active (${active.length})`}
        action={<TextLink href="/collaboration/business#requests">Collaboration hub →</TextLink>}
      >
        {active.length === 0 ? (
          <p className="text-sm text-muted">No published campaigns yet.</p>
        ) : (
          <ul className="divide-y divide-[#EEF2FA]">
            {active.map((brief) => (
              <li key={brief.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-indigo">{brief.title}</p>
                  <p className="text-xs text-muted">
                    {[brief.collabType, brief.budget ? `${brief.budgetCurrency} ${brief.budget}` : "", brief.location]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill tone={tone(brief.status)}>{brief.status}</StatusPill>
                  <Link
                    href={`/collaboration/business?intent=${encodeURIComponent(brief.id)}`}
                    className="text-xs font-bold text-violet hover:underline"
                  >
                    Open →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
