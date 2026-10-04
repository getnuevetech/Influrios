import Link from "next/link";
import { actionSaveCollabControlPlane } from "@/app/admin/collaboration-ops/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import {
  accountPurposeCatalog,
  getCollabControlPlane,
  listCorridorsForAdmin,
} from "@/lib/collab-control-plane";
import { formatMoney } from "@/lib/money";
import { ledgerTotals } from "@/lib/marketplace-ledger";
import { prisma } from "@/lib/db";
import { FEE_TYPE_LABELS, type FeeType } from "@/lib/collaboration-fees";
import type { FeeTypeAmount } from "@/lib/ledger";

export const dynamic = "force-dynamic";
export const metadata = { title: "Collaboration operations · Admin" };

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

function formatFeesByType(feesByType: FeeTypeAmount[], currency: string, totalCents: number) {
  if (feesByType.length === 0) return formatMoney(totalCents, currency);
  if (feesByType.length === 1) {
    const only = feesByType[0];
    const label = FEE_TYPE_LABELS[only.feeType as FeeType] ?? only.feeType;
    return `${label} ${formatMoney(only.amountCents, currency)}`;
  }
  const parts = feesByType.map((row) => {
    const label = FEE_TYPE_LABELS[row.feeType as FeeType] ?? row.feeType;
    return `${label} ${formatMoney(row.amountCents, currency)}`;
  });
  return `${formatMoney(totalCents, currency)} (${parts.join("; ")})`;
}

export default async function AdminCollaborationOpsPage({ searchParams }: Props) {
  const session = await requireAdminPage("collab_finance");
  const canManage = hasPermission(session, "collab_finance.manage");
  const canHighRisk = hasPermission(session, "collab_finance.high_risk");
  const params = await searchParams;
  const [plane, corridors, purposes, totals, recentAudits] = await Promise.all([
    getCollabControlPlane(),
    listCorridorsForAdmin().catch(() => []),
    Promise.resolve(accountPurposeCatalog()),
    ledgerTotals().catch(() => [] as Awaited<ReturnType<typeof ledgerTotals>>),
    prisma.auditLog
      .findMany({
        where: {
          OR: [
            { action: { startsWith: "corridor." } },
            { action: "collab.control_plane.save" },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 12,
      })
      .catch(() => []),
  ]);

  const activeCorridors = corridors.filter((row) => row.active).length;
  const suspendedCorridors = corridors.length - activeCorridors;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Collaboration operations</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Control plane for corridors, mentorship eligibility, dual-approval thresholds, guest collab limits, and
          account-purpose reference. Config is versioned and audit-logged — no deploy required.
        </p>
      </div>

      {params.saved ? <p className="text-sm font-semibold text-emerald-700">Control plane saved (v{plane.version}).</p> : null}
      {params.error ? <p className="text-sm font-semibold text-amber-800">{params.error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Control plane version", value: `v${plane.version}` },
          { label: "Active corridors", value: String(activeCorridors) },
          { label: "Suspended corridors", value: String(suspendedCorridors) },
          {
            label: "Dual-approval threshold",
            value: formatMoney(plane.dualApprovalThresholdCents),
          },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl border border-[#E4EBFF] bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{card.label}</p>
            <p className="mt-1 font-display text-xl font-bold text-indigo">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { href: "/admin/corridors", title: "Corridors", blurb: "Suspend / activate country matrix" },
          { href: "/admin/fees", title: "Fee rules", blurb: "Versioned commission matrix" },
          { href: "/admin/gateways", title: "Provider health", blurb: "Gateway readiness by country" },
          { href: "/admin/marketplace", title: "Financial reports", blurb: "Ledger totals & monthly report" },
          { href: "/admin/trust", title: "Risk / disputes", blurb: "Mediation & dual-approval decisions" },
          { href: "/admin/guests", title: "Guest profile gates", blurb: "Discover/profile soft & hard stops" },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-2xl border border-[#E4EBFF] bg-white p-4 transition hover:border-violet"
          >
            <p className="font-display text-base font-bold text-indigo">{link.title}</p>
            <p className="mt-1 text-xs text-muted">{link.blurb}</p>
          </Link>
        ))}
      </section>

      <section className="rounded-2xl border border-[#E4EBFF] bg-white p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Risk controls & eligibility</h2>
        <p className="mt-1 text-xs text-muted">
          Dual approval applies to manual financial overrides at or above the threshold. Mentorship and guest collab
          thresholds are enforced by product surfaces that read this plane.
        </p>
        <form action={actionSaveCollabControlPlane} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-muted">
            Dual-approval threshold (USD)
            <input
              name="dualApprovalUsd"
              type="number"
              min={0}
              step="0.01"
              defaultValue={(plane.dualApprovalThresholdCents / 100).toFixed(2)}
              disabled={!canManage}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
            />
          </label>
          <label className="text-xs font-semibold text-muted">
            Mentorship min followers
            <input
              name="minFollowers"
              type="number"
              min={0}
              defaultValue={plane.mentorship.minFollowers}
              disabled={!canManage}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-indigo sm:col-span-2">
            <input
              type="checkbox"
              name="mentorshipEnabled"
              value="1"
              defaultChecked={plane.mentorship.enabled}
              disabled={!canManage}
            />
            Mentorship module enabled
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-indigo">
            <input
              type="checkbox"
              name="requireIdentityVerified"
              value="1"
              defaultChecked={plane.mentorship.requireIdentityVerified}
              disabled={!canManage}
            />
            Mentors require identity verified
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-indigo">
            <input
              type="checkbox"
              name="requireGlobalPayoutReady"
              value="1"
              defaultChecked={plane.mentorship.requireGlobalPayoutReady}
              disabled={!canManage}
            />
            Mentors require Global Payout Ready
          </label>
          <label className="text-xs font-semibold text-muted sm:col-span-2">
            Mentorship notes
            <textarea
              name="mentorshipNotes"
              rows={2}
              defaultValue={plane.mentorship.notes}
              disabled={!canManage}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
            />
          </label>

          <h3 className="font-display text-sm font-bold text-indigo sm:col-span-2">Guest collab thresholds</h3>
          {(
            [
              ["proposeSoft", "Propose soft", plane.guestCollab.proposeSoft],
              ["proposeHard", "Propose hard", plane.guestCollab.proposeHard],
              ["applySoft", "Apply soft", plane.guestCollab.applySoft],
              ["applyHard", "Apply hard", plane.guestCollab.applyHard],
            ] as const
          ).map(([name, label, value]) => (
            <label key={name} className="text-xs font-semibold text-muted">
              {label}
              <input
                name={name}
                type="number"
                min={1}
                defaultValue={value}
                disabled={!canManage}
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
          ))}

          {canManage ? (
            <div className="sm:col-span-2 space-y-3">
              <label className="block text-xs font-semibold text-muted">
                Confirm password (required — high-risk threshold change)
                <input
                  name="stepUpPassword"
                  type="password"
                  autoComplete="current-password"
                  required={canHighRisk}
                  disabled={!canHighRisk}
                  placeholder={canHighRisk ? "Re-enter your admin password" : "High-risk permission required"}
                  className="mt-1 w-full max-w-md rounded-lg border border-border px-3 py-2 text-sm text-indigo"
                />
              </label>
              {!canHighRisk ? (
                <p className="text-xs text-amber-800">
                  Saving needs Collab finance · High-risk plus password step-up. Ask a Super or Collab Finance admin.
                </p>
              ) : null}
              <button type="submit" className="btn-primary !px-4 !py-2 text-sm" disabled={!canHighRisk}>
                Save control plane (bump version)
              </button>
            </div>
          ) : null}
        </form>
      </section>

      <section className="rounded-2xl border border-[#E4EBFF] bg-white p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Account purposes</h2>
        <p className="mt-1 text-xs text-muted">
          Logical domains from P4. Mapping provider wallets to these purposes is ops-owned; creator funds must not sit
          in Operations except earned fees.
        </p>
        <ul className="mt-4 space-y-3">
          {purposes.map((row) => (
            <li key={row.purpose} className="rounded-xl bg-[#F4F7FF] px-3 py-2">
              <p className="text-sm font-bold text-indigo">
                {row.purpose} · {row.label}
              </p>
              <p className="text-xs text-muted">{row.hint}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-[#E4EBFF] bg-white p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Financial snapshot</h2>
        <p className="mt-1 text-xs text-muted">
          Live ledger totals (provider-held). Full monthly report lives on Marketplace ledger when the financial reports
          switch is on.
        </p>
        {totals.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No ledger rows yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {totals.map((row) => (
              <li key={row.currency}>
                {row.currency}: held {formatMoney(row.heldCents, row.currency)} · released{" "}
                {formatMoney(row.releasedCents, row.currency)} · refunded{" "}
                {formatMoney(row.refundedCents, row.currency)} · fees{" "}
                {formatFeesByType(row.feesByType, row.currency, row.feeCents)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-[#E4EBFF] bg-white p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Recent control-plane audit</h2>
        {recentAudits.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No corridor or control-plane audit events yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-xs text-muted">
            {recentAudits.map((row) => (
              <li key={row.id}>
                <span className="font-semibold text-indigo">{row.action}</span> · {row.objectId ?? "—"} ·{" "}
                {row.actor} · {row.createdAt.toISOString()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
