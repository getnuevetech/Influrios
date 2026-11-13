import Link from "next/link";
import {
  actionAddClient,
  actionInviteAgencySeat,
  actionRevokeAgencySeat,
} from "@/app/agency/actions";
import { AgencyActionContext } from "@/app/agency/context-fields";

const NAV = [
  { href: "", label: "Agency overview" },
  { href: "clients", label: "Clients" },
  { href: "roster", label: "Influencer roster" },
  { href: "campaigns", label: "Campaigns" },
  { href: "contracts", label: "Contracts" },
  { href: "payments", label: "Payments" },
  { href: "team", label: "Team & access" },
  { href: "settings", label: "Settings" },
] as const;

export function AgencyWorkspaceBar({
  workspaces,
  workspaceId,
  workspaceName,
  clients,
  clientId,
  view,
  roleLabel,
  token,
  canManageClients,
  canManageTeam,
  seats,
}: {
  workspaces: { id: string; name: string }[];
  workspaceId: string;
  workspaceName: string;
  clients: { id: string; name: string }[];
  clientId: string;
  view: string;
  roleLabel: string | null;
  token: string;
  canManageClients: boolean;
  canManageTeam: boolean;
  seats: { id: string; email: string; role: string; inviteStatus: string }[];
}) {
  const selected = workspaces.find((item) => item.id === workspaceId);
  return (
    <div className="space-y-4">
      <form action="/agency" className="card-surface flex flex-wrap items-end gap-3 p-4">
        {view ? <input type="hidden" name="view" value={view} /> : null}
        <label className="text-sm">
          <span className="font-semibold text-indigo">Workspace</span>
          <select
            name="workspace"
            defaultValue={workspaceId}
            className="mt-1 block rounded-xl border border-border bg-white px-3 py-2"
          >
            {workspaces.length === 0 ? <option value={workspaceId}>{workspaceName}</option> : null}
            {workspaces.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-semibold text-indigo">Client</span>
          <select
            name="client"
            defaultValue={clientId}
            className="mt-1 block rounded-xl border border-border bg-white px-3 py-2"
          >
            <option value="">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-indigo">
          Switch
        </button>
        <p className="w-full text-xs text-muted">
          Open forms stay linked to their original workspace.
          {selected ? ` Selected membership: ${selected.name}` : ""}
          {roleLabel ? ` · ${roleLabel}` : ""}
        </p>
      </form>

      <nav className="flex gap-2 overflow-x-auto text-sm font-semibold">
        {NAV.map((item) => {
          const params = new URLSearchParams();
          if (workspaceId) params.set("workspace", workspaceId);
          if (clientId) params.set("client", clientId);
          if (item.href) params.set("view", item.href);
          const href =
            item.href === "contracts"
              ? "/collaboration/contracts"
              : item.href === "payments"
                ? "/payments"
                : item.href === "settings"
                  ? "/account"
                  : `/agency${params.toString() ? `?${params.toString()}` : ""}`;
          const current = item.href === view || (!item.href && !view);
          return (
            <Link
              key={item.label}
              href={href}
              className={`shrink-0 rounded-full px-3 py-1.5 ${current ? "bg-[#F1ECFF] text-violet" : "text-indigo"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {view === "clients" ? (
        <section className="card-surface space-y-3 p-5">
          <h2 className="font-display text-xl font-bold text-indigo">Clients</h2>
          {clients.length === 0 ? <p className="text-sm text-muted">No clients in this workspace yet.</p> : null}
          <ul className="space-y-1 text-sm text-indigo">
            {clients.map((client) => (
              <li key={client.id}>{client.name}</li>
            ))}
          </ul>
          {canManageClients && token ? (
            <form action={actionAddClient} className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <AgencyActionContext token={token} workspaceId={workspaceId} clientId={clientId} />
              <label className="text-sm">
                <span className="font-semibold text-indigo">Client name</span>
                <input
                  name="name"
                  required
                  placeholder="Client name"
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2"
                />
              </label>
              <button type="submit" className="btn-primary self-end !py-2.5 text-sm">
                Add client
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      {view === "team" ? (
        <section className="card-surface space-y-3 p-5">
          <h2 className="font-display text-xl font-bold text-indigo">Team & access</h2>
          <ul className="space-y-2 text-sm">
            {seats.map((seat) => (
              <li key={seat.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {seat.email} · <span className="capitalize">{seat.role}</span>
                  {seat.inviteStatus !== "accepted" ? ` · ${seat.inviteStatus}` : ""}
                </span>
                {canManageTeam && token ? (
                  <form action={actionRevokeAgencySeat}>
                    <AgencyActionContext token={token} workspaceId={workspaceId} clientId={clientId} />
                    <input type="hidden" name="email" value={seat.email} />
                    <button type="submit" className="text-xs font-semibold text-violet hover:underline">
                      Revoke
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          {canManageTeam && token ? (
            <form action={actionInviteAgencySeat} className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
              <AgencyActionContext token={token} workspaceId={workspaceId} clientId={clientId} />
              <input
                name="email"
                type="email"
                required
                placeholder="Seat email"
                className="rounded-xl border border-border bg-white px-3 py-2 text-sm"
              />
              <select name="role" defaultValue="member" className="rounded-xl border border-border bg-white px-3 py-2 text-sm">
                <option value="manager">Manager</option>
                <option value="member">Member</option>
              </select>
              <button type="submit" className="btn-primary !py-2 text-sm">
                Invite
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      {view === "contracts" ? (
        <p className="text-sm text-muted">
          Campaign contract labels come from the linked agreement. Open{" "}
          <Link href="/collaboration/contracts" className="font-semibold text-violet hover:underline">
            Contracts
          </Link>{" "}
          for the canonical record.
        </p>
      ) : null}
      {view === "payments" ? (
        <p className="text-sm text-muted">
          Paid appears only after the provider confirms the payout. Open{" "}
          <Link href="/payments" className="font-semibold text-violet hover:underline">
            Payments
          </Link>{" "}
          for the canonical record.
        </p>
      ) : null}
      {view === "settings" ? (
        <p className="text-sm text-muted">
          Workspace settings stay on{" "}
          <Link href="/account" className="font-semibold text-violet hover:underline">
            your account
          </Link>
          .
        </p>
      ) : null}
    </div>
  );
}
