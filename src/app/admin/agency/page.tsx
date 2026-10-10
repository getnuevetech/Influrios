import Link from "next/link";
import {
  actionAdminAddRoster,
  actionAdminAddSeat,
  actionAdminCreateCampaign,
  actionAdminCreatePortfolio,
  actionAdminRemoveRoster,
  actionAdminSetCampaignStatus,
  actionAdminSetSeat,
  actionAdminTogglePortfolio,
  actionCreateAgencyWorkspace,
  actionSaveAgencySeats,
} from "@/app/admin/agency/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import {
  agencyStats,
  getAgencyStore,
  listAgencySeats,
  listAgencyWorkspaces,
} from "@/lib/agency";
import { productSwitch } from "@/lib/product-switches";
import { indexCreatorsBySlug, listDirectoryCreators } from "@/lib/directory";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Agency" };

type Props = {
  searchParams: Promise<{
    error?: string;
    seats?: string;
    seat?: string;
    invite?: string;
    roster?: string;
    removed?: string;
    campaign?: string;
    portfolio?: string;
    status?: string;
    toggled?: string;
    workspaceId?: string;
    workspace?: string;
  }>;
};

export default async function AdminAgencyPage({ searchParams }: Props) {
  const session = await requireAdminPage("agency");
  const canManage = hasPermission(session, "agency.manage");
  const params = await searchParams;
  const workspaces = await listAgencyWorkspaces();
  const workspaceId =
    (params.workspaceId && workspaces.some((w) => w.id === params.workspaceId)
      ? params.workspaceId
      : null) ||
    workspaces[0]?.id ||
    null;
  const [store, seats, seatsOn] = await Promise.all([
    getAgencyStore(workspaceId),
    listAgencySeats(workspaceId),
    productSwitch("agency_seats"),
  ]);
  const stats = agencyStats(store);
  const directoryCreators = await listDirectoryCreators();
  const bySlug = indexCreatorsBySlug(directoryCreators);

  return (
    <div className="mx-auto max-w-[90rem] space-y-8 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
            ← Admin
          </Link>
          <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Agency</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Roster, campaigns, and joint portfolios for <span className="font-semibold text-indigo">{store.name}</span>{" "}
            ({store.agencyId}). Switch workspaces below for multi-tenant ops. Named seats stay off until you turn them
            on.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-center text-xs">
          <div className="rounded-xl bg-lavender px-4 py-2">
            <p className="font-display text-lg font-bold text-violet">{stats.roster}</p>
            <p className="text-muted">Roster</p>
          </div>
          <div className="rounded-xl bg-[#D9E8FF] px-4 py-2">
            <p className="font-display text-lg font-bold text-blue">{stats.campaigns}</p>
            <p className="text-muted">Campaigns</p>
          </div>
          <div className="rounded-xl bg-emerald-100 px-4 py-2">
            <p className="font-display text-lg font-bold text-emerald-700">{stats.published}</p>
            <p className="text-muted">Published</p>
          </div>
        </div>
      </div>

      <section className="card-surface flex flex-wrap items-end gap-3 p-5">
        <form className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold text-indigo">
            Workspace
            <select
              name="workspaceId"
              defaultValue={workspaceId ?? ""}
              className="mt-1 block min-w-[14rem] rounded-xl border border-border px-3 py-2 text-sm font-normal"
              onChange={undefined}
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.id})
                </option>
              ))}
            </select>
          </label>
          <noscript>
            <button type="submit" className="btn-secondary !py-2 text-sm">
              Switch
            </button>
          </noscript>
          {/* Server component: use links for switch without client JS */}
        </form>
        <div className="flex flex-wrap gap-2">
          {workspaces.map((w) => (
            <Link
              key={w.id}
              href={`/admin/agency?workspaceId=${encodeURIComponent(w.id)}`}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                w.id === workspaceId
                  ? "border-violet bg-lavender text-violet"
                  : "border-border text-indigo hover:border-violet"
              }`}
            >
              {w.name}
            </Link>
          ))}
        </div>
        {canManage ? (
          <form action={actionCreateAgencyWorkspace} className="ml-auto grid w-full gap-2 sm:w-auto sm:grid-cols-3">
            <input
              name="id"
              required
              placeholder="workspace_id"
              className="rounded-xl border border-border px-3 py-2 text-sm"
            />
            <input
              name="name"
              required
              placeholder="Display name"
              className="rounded-xl border border-border px-3 py-2 text-sm"
            />
            <button type="submit" className="btn-secondary !py-2 text-sm">
              Create workspace
            </button>
          </form>
        ) : null}
      </section>

      {params.error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {params.error}
        </div>
      ) : null}
      {params.seats ||
      params.seat ||
      params.roster ||
      params.removed ||
      params.campaign ||
      params.portfolio ||
      params.status ||
      params.toggled ||
      params.workspace ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Saved.
        </div>
      ) : null}

      {params.invite ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Seat invite created. Copy link:{" "}
          <code className="rounded bg-white px-1.5 py-0.5 text-xs text-indigo">{params.invite}</code>
        </div>
      ) : null}
      <section className="card-surface p-6">
        <h2 className="font-display text-xl font-bold text-indigo">Seats</h2>
        <p className="mt-1 text-sm text-muted">
          {seatsOn
            ? "Invite a teammate by email. They accept via copy-link (SMTP optional). Only accepted active seats can mutate /agency when seats are on."
            : "Agency seats are turned off. The roster below stays available; plan entitlement gates /agency."}
        </p>
        {canManage ? (
          <form action={actionSaveAgencySeats} className="mt-4 flex flex-wrap items-center gap-3">
            <input type="hidden" name="workspaceId" value={workspaceId ?? ""} />
            <label className="flex items-center gap-2 text-sm text-indigo">
              <input type="checkbox" name="agency_seats" defaultChecked={seatsOn} className="accent-violet" />
              Allow named seats
            </label>
            <button type="submit" className="btn-secondary !py-2 text-sm">
              Save seat switch
            </button>
          </form>
        ) : null}
        <ul className="mt-4 divide-y divide-border text-sm">
          {seats.length === 0 ? <li className="py-2 text-muted">No seats yet.</li> : null}
          {seats.map((seat) => (
            <li key={seat.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="font-semibold text-indigo">
                {seat.email} · {seat.role} · {seat.inviteStatus}
                {seat.active ? " · active" : " · inactive"}
                {seat.inviteToken && seat.inviteStatus === "pending" ? (
                  <>
                    {" "}
                    · invite{" "}
                    <code className="rounded bg-[#F0F4FF] px-1 text-[11px]">/agency/invite/{seat.inviteToken}</code>
                  </>
                ) : null}
              </span>
              {canManage ? (
                <form action={actionAdminSetSeat}>
                  <input type="hidden" name="workspaceId" value={workspaceId ?? ""} />
                  <input type="hidden" name="email" value={seat.email} />
                  <input type="hidden" name="active" value={seat.active ? "0" : "1"} />
                  <button type="submit" className="text-xs font-semibold text-violet">
                    {seat.active ? "Deactivate" : "Activate"}
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {canManage ? (
          <form action={actionAdminAddSeat} className="mt-4 grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="workspaceId" value={workspaceId ?? ""} />
            <input
              name="email"
              type="email"
              required
              placeholder="seat@agency.demo"
              className="rounded-xl border border-border px-3 py-2 text-sm"
            />
            <select name="role" defaultValue="member" className="rounded-xl border border-border px-3 py-2 text-sm">
              <option value="owner">Owner</option>
              <option value="manager">Manager</option>
              <option value="member">Member</option>
            </select>
            <button type="submit" className="btn-primary !py-2 text-sm" disabled={!seatsOn}>
              Invite seat
            </button>
          </form>
        ) : null}
      </section>

      <section className="card-surface overflow-x-auto p-6">
        <h2 className="font-display text-xl font-bold text-indigo">Roster</h2>
        <table className="mt-4 w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="pb-2 pr-3">Influencer</th>
              <th className="pb-2 pr-3">Role</th>
              <th className="pb-2 pr-3">Retainer</th>
              <th className="pb-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {store.roster.map((m) => (
              <tr key={m.creatorSlug} className="border-t border-border">
                <td className="py-2.5 pr-3 font-semibold text-indigo">
                  {bySlug.get(m.creatorSlug)?.displayName ?? m.creatorSlug}
                  {canManage ? (
                    <form action={actionAdminRemoveRoster} className="mt-1">
                      <input type="hidden" name="workspaceId" value={workspaceId ?? ""} />
                      <input type="hidden" name="creatorSlug" value={m.creatorSlug} />
                      <button type="submit" className="text-[11px] font-semibold text-rose-700">
                        Remove
                      </button>
                    </form>
                  ) : null}
                </td>
                <td className="py-2.5 pr-3 capitalize">{m.role}</td>
                <td className="py-2.5 pr-3">{m.retainerLabel}</td>
                <td className="py-2.5 text-muted">{m.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {canManage ? (
          <form action={actionAdminAddRoster} className="mt-4 grid gap-3 sm:grid-cols-4">
            <input type="hidden" name="workspaceId" value={workspaceId ?? ""} />
            <select name="creatorSlug" className="rounded-xl border border-border px-3 py-2 text-sm" required>
              {directoryCreators.filter((c) => !store.roster.some((r) => r.creatorSlug === c.slug)).map(
                (c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.displayName}
                  </option>
                ),
              )}
            </select>
            <select name="role" className="rounded-xl border border-border px-3 py-2 text-sm" defaultValue="talent">
              <option value="lead">Lead</option>
              <option value="specialist">Specialist</option>
              <option value="talent">Talent</option>
            </select>
            <input
              name="retainerLabel"
              placeholder="Retainer"
              className="rounded-xl border border-border px-3 py-2 text-sm"
            />
            <button type="submit" className="btn-primary !py-2 text-sm">
              Add
            </button>
          </form>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-indigo">Campaigns</h2>
        {store.campaigns.map((c) => (
          <article key={c.id} className="card-surface p-5">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase text-violet">{c.clientName}</p>
                <h3 className="font-display text-lg font-bold text-indigo">{c.title}</h3>
                <p className="text-sm text-muted">
                  {[c.summary, c.status, c.budgetLabel].filter(Boolean).join(" · ")}
                </p>
              </div>
              {canManage ? (
                <div className="flex flex-wrap gap-1">
                  {(["briefing", "casting", "live", "wrapped"] as const).map((st) => (
                    <form key={st} action={actionAdminSetCampaignStatus}>
                      <input type="hidden" name="workspaceId" value={workspaceId ?? ""} />
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="status" value={st} />
                      <button
                        type="submit"
                        className="rounded-lg border border-border px-2 py-1 text-[11px] font-semibold"
                      >
                        {st}
                      </button>
                    </form>
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        ))}
        {canManage ? (
          <form action={actionAdminCreateCampaign} className="card-surface grid gap-3 p-5 sm:grid-cols-2">
            <input type="hidden" name="workspaceId" value={workspaceId ?? ""} />
            <input name="title" required placeholder="Title" className="rounded-xl border border-border px-3 py-2 text-sm" />
            <input name="clientName" required placeholder="Client" className="rounded-xl border border-border px-3 py-2 text-sm" />
            <input name="specialty" placeholder="Specialty" className="rounded-xl border border-border px-3 py-2 text-sm" />
            <input name="budgetLabel" placeholder="Budget" className="rounded-xl border border-border px-3 py-2 text-sm" />
            <input
              name="creatorSlugs"
              defaultValue={store.roster.slice(0, 2).map((r) => r.creatorSlug).join(",")}
              className="rounded-xl border border-border px-3 py-2 text-sm sm:col-span-2"
              placeholder="creator slugs, comma-separated"
            />
            <input
              name="summary"
              placeholder="What this campaign covers"
              className="rounded-xl border border-border px-3 py-2 text-sm sm:col-span-2"
            />
            <button type="submit" className="btn-primary sm:col-span-2 !py-2 text-sm">
              Create campaign
            </button>
          </form>
        ) : null}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-indigo">Joint portfolios</h2>
        {store.portfolios.map((p) => (
          <article key={p.id} className="card-surface flex flex-wrap items-start justify-between gap-3 p-5">
            <div>
              <h3 className="font-display text-lg font-bold text-indigo">{p.title}</h3>
              <p className="text-sm text-muted">
                {bySlug.get(p.leftSlug)?.displayName} ×{" "}
                {bySlug.get(p.rightSlug)?.displayName}
                {p.published ? " · published" : " · draft"}
              </p>
              <p className="mt-1 text-sm text-muted">{p.outcome}</p>
            </div>
            {canManage ? (
              <form action={actionAdminTogglePortfolio}>
                <input type="hidden" name="workspaceId" value={workspaceId ?? ""} />
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="published" value={p.published ? "0" : "1"} />
                <button type="submit" className="btn-secondary !py-1.5 text-xs">
                  {p.published ? "Unpublish" : "Publish"}
                </button>
              </form>
            ) : null}
          </article>
        ))}
        {canManage ? (
          <form action={actionAdminCreatePortfolio} className="card-surface grid gap-3 p-5 sm:grid-cols-2">
            <input type="hidden" name="workspaceId" value={workspaceId ?? ""} />
            <input name="title" required placeholder="Title" className="rounded-xl border border-border px-3 py-2 text-sm sm:col-span-2" />
            <input name="tagline" placeholder="Tagline" className="rounded-xl border border-border px-3 py-2 text-sm sm:col-span-2" />
            <select name="leftSlug" required defaultValue="" className="rounded-xl border border-border px-3 py-2 text-sm">
              <option value="" disabled>Influencer A</option>
              {directoryCreators.map((c) => (
                <option key={c.slug} value={c.slug}>{c.displayName}</option>
              ))}
            </select>
            <select name="rightSlug" required defaultValue="" className="rounded-xl border border-border px-3 py-2 text-sm">
              <option value="" disabled>Influencer B</option>
              {directoryCreators.map((c) => (
                <option key={c.slug} value={c.slug}>{c.displayName}</option>
              ))}
            </select>
            <input name="specialty" placeholder="Specialty" className="rounded-xl border border-border px-3 py-2 text-sm" />
            <select name="campaignId" className="rounded-xl border border-border px-3 py-2 text-sm">
              <option value="">No campaign</option>
              {store.campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <textarea name="outcome" rows={2} placeholder="What happened" className="rounded-xl border border-border px-3 py-2 text-sm sm:col-span-2" />
            <textarea name="metrics" rows={2} placeholder={"Label | value"} className="rounded-xl border border-border px-3 py-2 text-sm sm:col-span-2" />
            <label className="flex items-center gap-2 text-sm text-indigo sm:col-span-2">
              <input name="published" type="checkbox" />
              Publish
            </label>
            <button type="submit" className="btn-primary sm:col-span-2 !py-2 text-sm">
              Create portfolio
            </button>
          </form>
        ) : null}
      </section>

      <p className="text-xs text-muted">
        {store.notes ? <>{store.notes} · </> : null}
        Public:{" "}
        <Link href="/agency" className="font-semibold text-violet hover:underline">
          /agency
        </Link>
      </p>
    </div>
  );
}
