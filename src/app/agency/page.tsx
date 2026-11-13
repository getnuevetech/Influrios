import Image from "next/image";
import Link from "next/link";
import {
  actionAddRoster,
  actionCreateCampaign,
  actionCreatePortfolio,
  actionLinkCampaignAgreement,
  actionSetCampaignStatus,
  actionTogglePortfolio,
} from "@/app/agency/actions";
import { AgencyActionContext } from "@/app/agency/context-fields";
import { AgencyWorkspaceBar } from "@/app/agency/workspace-bar";
import { MemberFrame } from "@/components/account-shell";
import {
  agencyStats,
  agencyWorkspaceIdForOwner,
  getAgencyStore,
  listAgencySeats,
  listPublishedPortfolios,
  loadAgencyCampaignFacts,
} from "@/lib/agency";
import { resolveAgencyAccess } from "@/lib/agency-auth";
import { agencyActionAllowed, nextCampaignStatus, sealAgencyActionContext, summarizeCampaignRecords } from "@/lib/agency-context";
import { getWorkspace } from "@/lib/business";
import { indexCreatorsBySlug, listDirectoryCreators } from "@/lib/directory";
import { prisma } from "@/lib/db";
import { productSwitch } from "@/lib/product-switches";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agency Workspace" };

type Props = {
  searchParams: Promise<{
    error?: string;
    roster?: string;
    campaign?: string;
    portfolio?: string;
    plan?: string;
    status?: string;
    toggled?: string;
    seat?: string;
    workspace?: string;
    client?: string;
    view?: string;
  }>;
};

const CAMP_COLOR: Record<string, string> = {
  briefing: "bg-slate-100 text-slate-700",
  casting: "bg-amber-100 text-amber-800",
  live: "bg-emerald-100 text-emerald-800",
  wrapped: "bg-blue-100 text-blue-800",
};

export default async function AgencyPage({ searchParams }: Props) {
  const params = await searchParams;
  const access = await resolveAgencyAccess(params.workspace);
  const [ws, seatsOn] = await Promise.all([
    getWorkspace(access.ok ? access.account?.id : null),
    productSwitch("agency_seats"),
  ]);
  const role =
    access.ok && access.mode === "seat"
      ? access.role
      : access.ok && access.mode === "plan"
        ? "owner"
        : null;
  const workspaceId =
    access.ok && access.mode === "seat"
      ? access.seat.workspaceId
      : access.ok && access.mode === "plan" && access.account?.id
        ? agencyWorkspaceIdForOwner(access.account.id)
        : null;
  const unlocked = Boolean(workspaceId);
  const store = await getAgencyStore(workspaceId);
  const stats = agencyStats(store);
  const published = listPublishedPortfolios(store);
  const directoryCreators = await listDirectoryCreators();
  const bySlug = indexCreatorsBySlug(directoryCreators);
  const clients = workspaceId
    ? await prisma.agencyClient.findMany({ where: { workspaceId }, orderBy: { name: "asc" } })
    : [];
  const selectedClient = clients.find((client) => client.id === params.client) ?? null;
  const facts = workspaceId ? await loadAgencyCampaignFacts(workspaceId) : [];
  const team = workspaceId
    ? (await listAgencySeats(workspaceId)).map((seat) => ({
        id: seat.id,
        email: seat.email,
        role: seat.role,
        inviteStatus: seat.inviteStatus,
      }))
    : [];
  const accountId = access.ok ? access.account?.id ?? "" : "";
  const token =
    workspaceId && accountId
      ? sealAgencyActionContext({
          userId: accountId,
          workspaceId,
          clientId: selectedClient?.id ?? "",
        })
      : "";
  const canRoster = agencyActionAllowed(role, "manage_roster");
  const canCampaign = agencyActionAllowed(role, "manage_campaign");
  const canStatus = agencyActionAllowed(role, "set_campaign_status");
  const canPortfolio = agencyActionAllowed(role, "manage_portfolio");
  const canClients = agencyActionAllowed(role, "act_for_client");
  const canTeam = agencyActionAllowed(role, "manage_team");
  const view = params.view ?? "";
  const showRoster = view === "" || view === "overview" || view === "roster";
  const showCampaigns = view === "" || view === "overview" || view === "campaigns" || view === "contracts" || view === "payments";
  const showPortfolios = view === "" || view === "overview";
  const visibleCampaigns = selectedClient
    ? store.campaigns.filter(
        (campaign) => campaign.clientId === selectedClient.id || (!campaign.clientId && campaign.clientName === selectedClient.name),
      )
    : store.campaigns;
  const switcher =
    access.ok && access.mode !== "plan"
      ? access.seats.map((seat) => ({ id: seat.workspaceId, name: seat.workspaceName }))
      : workspaceId
        ? [{ id: workspaceId, name: store.name }]
        : [];
  const seatLabel = role ? `${role}` : null;
  const denial = access.ok ? access.denial : null;

  const body = (
    <div className="bg-[#F7FAFF]">
      <section className="hero-atmosphere text-white">
        <div className="mx-auto max-w-[90rem] px-4 py-12 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lavender/80">
            Agency
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold">{store.name}</h1>
          <p className="mt-3 max-w-2xl text-white/75">
            Multi-creator roster, client campaigns, and joint portfolio case studies — Agency plan
            unlocks full workspace tools.
          </p>
          <p className="mt-4 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
            Business plan: {ws.plan}
            {unlocked ? " · Agency workspace on" : " · upgrade required"}
            {seatsOn ? " · seats on" : ""}
            {seatLabel ? ` · acting as ${seatLabel}` : ""}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[90rem] space-y-8 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap gap-3 text-center text-xs">
          <div className="rounded-xl bg-lavender px-4 py-2">
            <p className="font-display text-lg font-bold text-violet">{stats.roster}</p>
            <p className="text-muted">Roster</p>
          </div>
          <div className="rounded-xl bg-[#D9E8FF] px-4 py-2">
            <p className="font-display text-lg font-bold text-blue">{stats.live}</p>
            <p className="text-muted">Live campaigns</p>
          </div>
          <div className="rounded-xl bg-emerald-100 px-4 py-2">
            <p className="font-display text-lg font-bold text-emerald-700">{stats.published}</p>
            <p className="text-muted">Published cases</p>
          </div>
        </div>

        {params.seat === "accepted" ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Seat invite accepted for this workspace.
          </div>
        ) : null}
        {denial ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {denial}
          </div>
        ) : null}

        <AgencyWorkspaceBar
          workspaces={switcher}
          workspaceId={workspaceId ?? ""}
          workspaceName={store.name}
          clients={clients.map((client) => ({ id: client.id, name: client.name }))}
          clientId={selectedClient?.id ?? ""}
          view={view}
          roleLabel={seatLabel}
          token={token}
          canManageClients={canClients}
          canManageTeam={canTeam}
          seats={team}
        />

        {params.error === "agency_plan_required" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Agency plan required to change the roster, campaigns, and portfolios.{" "}
            <Link href="/billing" className="font-semibold text-violet underline">
              Upgrade on Billing →
            </Link>
          </div>
        ) : params.error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {params.error}
          </div>
        ) : null}

        {params.plan || params.roster || params.campaign || params.portfolio || params.status ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Saved
            {params.plan ? ` · plan ${params.plan}` : ""}
            {params.roster ? " · roster updated" : ""}
            {params.campaign ? " · campaign created" : ""}
            {params.portfolio ? " · portfolio created" : ""}
            {params.status ? " · campaign status updated" : ""}.
          </div>
        ) : null}

        {!unlocked ? (
          <section className="card-surface flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <h2 className="font-display text-xl font-bold text-indigo">
                {seatsOn ? "Agency seat required" : "Unlock Agency workspace"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {seatsOn
                  ? "Named seats are on. Accept an invite for your signed-in email, or ask an admin to invite you."
                  : `Current plan is ${ws.plan}. Agency adds roster, multi-creator casting, and joint portfolios.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {seatsOn ? (
                <Link href="/login?next=%2Fagency" className="btn-primary !py-2 text-sm">
                  Sign in →
                </Link>
              ) : (
                <Link href="/billing" className="btn-primary !py-2 text-sm">
                  Upgrade on Billing →
                </Link>
              )}
            </div>
          </section>
        ) : null}

        {showRoster ? (
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold text-indigo">Talent roster</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {store.roster.map((m) => {
              const c = bySlug.get(m.creatorSlug);
              return (
                <article key={m.creatorSlug} className="card-surface flex gap-3 p-4">
                  {c?.image ? (
                    <Image
                      src={c.image}
                      alt={c.displayName}
                      width={56}
                      height={56}
                      className="h-14 w-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-lavender text-sm font-bold text-violet">
                      {m.creatorSlug.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-indigo">
                      {c?.displayName ?? m.creatorSlug}
                    </p>
                    <p className="text-xs capitalize text-violet">
                      {m.role}
                      {m.retainerLabel ? ` · ${m.retainerLabel}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted">{m.notes}</p>
                    <Link
                      href={`/creators/${m.creatorSlug}`}
                      className="mt-1 inline-block text-xs font-semibold text-violet hover:underline"
                    >
                      Profile →
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          {canRoster && token ? (
            <form action={actionAddRoster} className="card-surface mt-2 grid gap-3 p-5 sm:grid-cols-2">
              <AgencyActionContext token={token} workspaceId={workspaceId ?? ""} clientId={selectedClient?.id ?? ""} />
              <h3 className="font-display text-lg font-bold text-indigo sm:col-span-2">
                Add to roster
              </h3>
              <label className="text-sm">
                <span className="font-semibold text-indigo">Influencer</span>
                <select
                  name="creatorSlug"
                  required
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                >
                  {directoryCreators.filter(
                    (c) => !store.roster.some((r) => r.creatorSlug === c.slug),
                  ).map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="font-semibold text-indigo">Role</span>
                <select
                  name="role"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                  defaultValue="talent"
                >
                  <option value="lead">Lead</option>
                  <option value="specialist">Specialist</option>
                  <option value="talent">Talent</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="font-semibold text-indigo">Retainer</span>
                <input
                  name="retainerLabel"
                  placeholder="Retainer"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="font-semibold text-indigo">Notes</span>
                <input
                  name="notes"
                  placeholder="Positioning"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                />
              </label>
              <button type="submit" className="btn-primary sm:col-span-2 !py-2.5 text-sm">
                Add creator →
              </button>
            </form>
          ) : null}
        </section>
        ) : null}

        {showCampaigns ? (
        <section className="space-y-4">
          <h2 className="font-display text-2xl font-bold text-indigo">Campaigns</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2">Campaign</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Contract</th>
                  <th className="px-3 py-2">Payment</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleCampaigns.map((camp) => {
                  const campFacts = facts.filter((fact) => fact.campaignId === camp.id);
                  const record = summarizeCampaignRecords(
                    campFacts.length > 0
                      ? campFacts
                      : camp.creatorSlugs.map(() => ({
                          contractStatus: null,
                          payoutState: null,
                          milestoneStatus: null,
                        })),
                  );
                  const nextStatus = nextCampaignStatus(camp.status);
                  return (
                    <tr key={camp.id} className="border-t border-border">
                      <td className="px-3 py-3 font-semibold text-indigo">{camp.title}</td>
                      <td className="px-3 py-3">{camp.clientName}</td>
                      <td className="px-3 py-3">{record.contract}</td>
                      <td className="px-3 py-3">{record.payment}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${CAMP_COLOR[camp.status]}`}>
                          {camp.status}
                        </span>
                        {canStatus && token && nextStatus ? (
                          <form action={actionSetCampaignStatus} className="mt-2">
                            <AgencyActionContext token={token} workspaceId={workspaceId ?? ""} clientId={selectedClient?.id ?? ""} />
                            <input type="hidden" name="id" value={camp.id} />
                            <input type="hidden" name="status" value={nextStatus} />
                            <button
                              type="submit"
                              className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-indigo hover:bg-lavender"
                            >
                              Move to {nextStatus}
                            </button>
                          </form>
                        ) : null}
                        {canCampaign && token && camp.creatorSlugs.length > 0 ? (
                          <form action={actionLinkCampaignAgreement} className="mt-2 grid gap-1">
                            <AgencyActionContext token={token} workspaceId={workspaceId ?? ""} clientId={selectedClient?.id ?? ""} />
                            <input type="hidden" name="id" value={camp.id} />
                            <select name="creatorSlug" className="rounded-lg border border-border bg-white px-2 py-1 text-xs">
                              {camp.creatorSlugs.map((slug) => (
                                <option key={slug} value={slug}>
                                  {bySlug.get(slug)?.displayName ?? slug}
                                </option>
                              ))}
                            </select>
                            <input
                              name="collaborationId"
                              required
                              placeholder="Existing agreement"
                              className="rounded-lg border border-border bg-white px-2 py-1 text-xs"
                            />
                            <button type="submit" className="text-left text-xs font-semibold text-violet hover:underline">
                              Link agreement
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {canCampaign && token && selectedClient ? (
            <form
              action={actionCreateCampaign}
              className="card-surface grid gap-3 p-5 sm:grid-cols-2"
            >
              <AgencyActionContext token={token} workspaceId={workspaceId ?? ""} clientId={selectedClient.id} />
              <h3 className="font-display text-lg font-bold text-indigo sm:col-span-2">
                New campaign for {selectedClient.name}
              </h3>
              <label className="text-sm">
                <span className="font-semibold text-indigo">Title</span>
                <input
                  name="title"
                  required
                  placeholder="Campaign title"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                />
              </label>
              <p className="text-sm text-muted sm:col-span-2">
                This creates a campaign container. It does not sign a contract or move a payment. Each influencer keeps a separate agreement.
              </p>
              <label className="text-sm">
                <span className="font-semibold text-indigo">Specialty</span>
                <input
                  name="specialty"
                  placeholder="Specialty"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="font-semibold text-indigo">Budget</span>
                <input
                  name="budgetLabel"
                  placeholder="Budget"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="font-semibold text-indigo">Cast (comma slugs)</span>
                <input
                  name="creatorSlugs"
                  defaultValue={store.roster
                    .slice(0, 2)
                    .map((r) => r.creatorSlug)
                    .join(",")}
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="font-semibold text-indigo">Summary</span>
                <input
                  name="summary"
                  placeholder="What this campaign covers"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                />
              </label>
              <button type="submit" className="btn-primary sm:col-span-2 !py-2.5 text-sm">
                Create campaign →
              </button>
            </form>
          ) : null}
        </section>
        ) : null}

        {showPortfolios ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold text-indigo">
                Joint portfolios
              </h2>
              <p className="mt-1 text-sm text-muted">
                Joint portfolios for complementary creator pairs on this agency workspace.
              </p>
            </div>
            <Link
              href="/collaboration"
              className="text-sm font-semibold text-violet hover:underline"
            >
              Collaboration explorer →
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {store.portfolios.map((p) => {
              const left = bySlug.get(p.leftSlug);
              const right = bySlug.get(p.rightSlug);
              return (
                <article key={p.id} className="card-surface p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-violet">
                      {p.specialty}
                      {!p.published ? " · draft" : ""}
                    </p>
                    {canPortfolio && token ? (
                      <form action={actionTogglePortfolio}>
                        <AgencyActionContext token={token} workspaceId={workspaceId ?? ""} clientId={selectedClient?.id ?? ""} />
                        <input type="hidden" name="id" value={p.id} />
                        <input
                          type="hidden"
                          name="published"
                          value={p.published ? "0" : "1"}
                        />
                        <button
                          type="submit"
                          className="text-xs font-semibold text-violet hover:underline"
                        >
                          {p.published ? "Unpublish" : "Publish"}
                        </button>
                      </form>
                    ) : null}
                  </div>
                  <h3 className="mt-1 font-display text-lg font-bold text-indigo">{p.title}</h3>
                  <p className="text-sm text-muted">{p.tagline}</p>
                  <p className="mt-2 text-sm font-semibold text-indigo">
                    {left?.displayName ?? p.leftSlug} × {right?.displayName ?? p.rightSlug}
                  </p>
                  <p className="mt-2 text-sm text-muted">{p.outcome}</p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs">
                    {p.metrics.map((m) => (
                      <span
                        key={m.label}
                        className="rounded-lg bg-[#F0F4FF] px-2.5 py-1 font-semibold text-indigo"
                      >
                        {m.value} <span className="font-normal text-muted">{m.label}</span>
                      </span>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>

          {canPortfolio && token ? (
            <form
              action={actionCreatePortfolio}
              className="card-surface grid gap-3 p-5 sm:grid-cols-2"
            >
              <AgencyActionContext token={token} workspaceId={workspaceId ?? ""} clientId={selectedClient?.id ?? ""} />
              <h3 className="font-display text-lg font-bold text-indigo sm:col-span-2">
                New joint case study
              </h3>
              <label className="text-sm sm:col-span-2">
                <span className="font-semibold text-indigo">Title</span>
                <input
                  name="title"
                  required
                  placeholder="Case study title"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="font-semibold text-indigo">Tagline</span>
                <input
                  name="tagline"
                  placeholder="Tagline"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="font-semibold text-indigo">Influencer A</span>
                <select
                  name="leftSlug"
                  required
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                  defaultValue={store.roster[0]?.creatorSlug}
                >
                  {directoryCreators.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="font-semibold text-indigo">Influencer B</span>
                <select
                  name="rightSlug"
                  required
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                  defaultValue={store.roster[1]?.creatorSlug ?? directoryCreators[1]?.slug}
                >
                  {directoryCreators.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="font-semibold text-indigo">Specialty</span>
                <input
                  name="specialty"
                  placeholder="Specialty"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                />
              </label>
              <label className="text-sm">
                <span className="font-semibold text-indigo">Link campaign</span>
                <select
                  name="campaignId"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                >
                  <option value="">— none —</option>
                  {store.campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="font-semibold text-indigo">Outcome</span>
                <textarea
                  name="outcome"
                  rows={2}
                  placeholder="What happened"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="font-semibold text-indigo">
                  Metrics (one per line: Label | Value)
                </span>
                <textarea
                  name="metrics"
                  rows={3}
                  placeholder={"Label | value"}
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                />
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" name="published" defaultChecked className="rounded" />
                <span className="font-semibold text-indigo">Publish to collaboration surface</span>
              </label>
              <button type="submit" className="btn-primary sm:col-span-2 !py-2.5 text-sm">
                Create portfolio →
              </button>
            </form>
          ) : null}

          {published.length === 0 ? (
            <p className="text-sm text-muted">No published case studies yet.</p>
          ) : null}
        </section>
        ) : null}

        <p className="text-center text-sm text-muted">
          Every action retains its client and workspace. Permissions follow the selected membership. Campaigns link to the same contracts, deliveries, and payments.
        </p>
      </div>
    </div>
  );

  if (access.ok && access.account?.role === "AGENCY") {
    return <MemberFrame>{body}</MemberFrame>;
  }
  return body;
}
