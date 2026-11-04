"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  actionAddAccountNote,
  actionBulkAccountUpdate,
  actionSaveMember,
  actionSendPasswordReset,
  actionSetInfluencerIdentityKyc,
} from "@/app/admin/accounts/actions";
import { AccountPolicyForm } from "@/app/admin/accounts/account-section";
import type {
  AccountDetailExtras,
  AccountKpis,
  AccountTableRow,
  AccountsTab,
  AdminConsoleRow,
} from "@/lib/admin-accounts";
import {
  IconArrowRight,
  IconBuilding,
  IconCheck,
  IconDots,
  IconIdCard,
  IconMail,
  IconSearch,
  IconUser,
  IconUsers,
  IconWallet,
} from "@/components/icons";

function trendText(pct: number | null) {
  if (pct == null) return "—";
  const arrow = pct >= 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(pct)}%`;
}

function formatFollowers(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function planTone(plan: string) {
  const p = plan.toUpperCase();
  if (p.includes("PRO") || p.includes("PLUS") || p.includes("AGENCY")) {
    return "bg-amber-50 text-amber-800 border-amber-100";
  }
  if (p.includes("BUSINESS")) return "bg-[#E8F1FF] text-blue border-[#D6E6FF]";
  return "bg-[#EEE8FF] text-violet border-[#E0D6FF]";
}

function kycBadge(identity: string | null | undefined, submission: string | null | undefined) {
  const v = (identity ?? "UNVERIFIED").toUpperCase();
  if (v === "VERIFIED") return { text: "Verified", className: "bg-emerald-50 text-emerald-700" };
  if (v === "PENDING" || submission?.includes("submitted") || submission?.includes("pending")) {
    return { text: "In review", className: "bg-amber-50 text-amber-800" };
  }
  if (v === "REJECTED") return { text: "Rejected", className: "bg-rose-50 text-rose-600" };
  return { text: "Not verified", className: "bg-[#F3F6FF] text-muted" };
}

function statusBadge(suspendedAt: string | null) {
  if (suspendedAt) return { text: "Restricted", className: "bg-rose-50 text-rose-600" };
  return { text: "Active", className: "bg-emerald-50 text-emerald-700" };
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || "")
      .join("") || "?"
  );
}

function buildHref(
  basePath: string,
  opts: Record<string, string | number | undefined | null>,
) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(opts)) {
    if (v == null || v === "" || v === "all") continue;
    params.set(k, String(v));
  }
  const q = params.toString();
  return q ? `${basePath}?${q}` : basePath;
}

export function AdminUserAccountsView({
  tab,
  basePath,
  kpis,
  rows,
  total,
  page,
  pageSize,
  filters,
  selected,
  detail,
  planOptions,
  roleOptions,
  canEdit,
  canManageAdmins,
  adminRows,
  adminRoles,
  flash,
  policy,
}: {
  tab: AccountsTab;
  basePath: string;
  kpis: AccountKpis;
  rows: AccountTableRow[];
  total: number;
  page: number;
  pageSize: number;
  filters: {
    q?: string;
    status?: string;
    plan?: string;
    kyc?: string;
  };
  selected: AccountTableRow | null;
  detail: AccountDetailExtras | null;
  planOptions: string[];
  roleOptions: string[];
  canEdit: boolean;
  canManageAdmins: boolean;
  adminRows: AdminConsoleRow[];
  adminRoles: { id: string; name: string }[];
  flash: { saved?: string; error?: string; reset?: string };
  policy: { consentVersion: string; consentCopy: string; passwordMinLength: number };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailTab, setDetailTab] = useState<"overview" | "details" | "kyc" | "activity" | "billing">(
    "overview",
  );

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const currentQuery = useMemo(
    () => ({
      tab: tab === "influencer" || tab === "business" ? undefined : tab,
      q: filters.q,
      status: filters.status,
      plan: filters.plan,
      kyc: filters.kyc,
      page: page > 1 ? page : undefined,
    }),
    [tab, filters, page],
  );

  function go(patch: Record<string, string | number | undefined | null>) {
    startTransition(() => {
      router.push(buildHref(basePath, { ...currentQuery, ...patch }));
    });
  }

  function toggleId(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAllOnPage() {
    const ids = rows.map((r) => r.id);
    setSelectedIds((prev) => (ids.every((id) => prev.includes(id)) ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]));
  }

  const exportHref = `/admin/accounts/export?tab=${tab}${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ""}${
    filters.status && filters.status !== "all" ? `&status=${filters.status}` : ""
  }`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet">Account Management</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-indigo">User Accounts</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted">
            Manage influencer, business, and admin console accounts — verification, plans, access, and
            outreach from one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={exportHref}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E4EBFF] bg-white px-3 py-1.5 text-[12px] font-semibold text-indigo shadow-sm hover:border-violet/40"
          >
            Export CSV
          </a>
          <Link
            href="/admin/invitations"
            className="inline-flex items-center gap-1.5 rounded-full bg-violet px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:bg-[#5530e0]"
          >
            Send invite
          </Link>
        </div>
      </div>

      {flash.saved === "policy" ? (
        <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          Account policy saved.
        </p>
      ) : null}
      {flash.saved === "member" || flash.saved === "bulk" || flash.saved === "note" ? (
        <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          Account changes saved.
        </p>
      ) : null}
      {flash.saved?.startsWith("kyc-") ? (
        <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          Identity KYC updated.
        </p>
      ) : null}
      {flash.reset === "sent" ? (
        <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          Password reset email queued.
        </p>
      ) : null}
      {flash.reset === "failed" || flash.error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          That change could not be completed. Check permissions and try again.
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          {
            label: "Total Accounts",
            value: kpis.total.toLocaleString(),
            trend: trendText(kpis.totalTrendPct),
            icon: IconUsers,
            tone: "bg-[#EEE8FF] text-violet",
          },
          {
            label: "Influencers",
            value: kpis.influencers.toLocaleString(),
            trend: trendText(kpis.influencersTrendPct),
            icon: IconUser,
            tone: "bg-[#EEE8FF] text-violet",
          },
          {
            label: "Businesses",
            value: kpis.businesses.toLocaleString(),
            trend: trendText(kpis.businessesTrendPct),
            icon: IconBuilding,
            tone: "bg-[#E8F1FF] text-blue",
          },
          {
            label: "Verified (KYC)",
            value: kpis.verifiedKyc.toLocaleString(),
            trend: kpis.verifiedPct != null ? `${kpis.verifiedPct}% of accounts` : "—",
            icon: IconIdCard,
            tone: "bg-emerald-50 text-emerald-600",
          },
          {
            label: "Pending Review",
            value: kpis.pendingReview.toLocaleString(),
            trend: "Needs attention",
            icon: IconIdCard,
            tone: "bg-rose-50 text-rose-500",
            alert: true,
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-[#E4EBFF] bg-white p-4 shadow-[0_8px_24px_rgba(17,26,90,0.04)]"
            >
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${card.tone}`}>
                <Icon size={16} />
              </span>
              <p className="mt-3 text-[12px] font-semibold text-muted">{card.label}</p>
              <p className="mt-1 font-display text-2xl font-bold text-indigo">{card.value}</p>
              <p className={`mt-1 text-[11px] font-semibold ${card.alert ? "text-rose-500" : "text-emerald-600"}`}>
                {card.trend}
              </p>
            </div>
          );
        })}
      </section>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["influencer", "Influencer Accounts", "/admin/accounts"],
            ["business", "Business Accounts", "/admin/business-accounts"],
            ["all", "All Accounts", "/admin/accounts?tab=all"],
            ["admin", "Admin Accounts", "/admin/accounts?tab=admin"],
          ] as const
        ).map(([id, label, href]) => (
          <Link
            key={id}
            href={href}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${
              tab === id
                ? "bg-violet text-white shadow-sm"
                : "border border-[#E4EBFF] bg-white text-indigo hover:border-violet/40"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {tab === "admin" ? (
        <AdminAccountsPanel
          rows={adminRows}
          roles={adminRoles}
          canManage={canManageAdmins}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-3">
            <form
              className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#E4EBFF] bg-white p-3 shadow-sm"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                go({
                  q: String(fd.get("q") || "") || undefined,
                  status: String(fd.get("status") || "all"),
                  plan: String(fd.get("plan") || "") || undefined,
                  kyc: String(fd.get("kyc") || "all"),
                  page: 1,
                  id: undefined,
                });
              }}
            >
              <label className="relative min-w-[220px] flex-1">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
                  <IconSearch size={14} />
                </span>
                <input
                  name="q"
                  defaultValue={filters.q || ""}
                  placeholder={
                    tab === "business"
                      ? "Search businesses (name, email, ID...)"
                      : "Search influencers (name, email, handle, ID...)"
                  }
                  className="w-full rounded-full border border-[#E4EBFF] bg-[#F7F9FF] py-2 pl-9 pr-3 text-[13px] outline-none focus:border-violet focus:bg-white"
                />
              </label>
              <select
                name="status"
                defaultValue={filters.status || "all"}
                className="rounded-full border border-[#E4EBFF] bg-white px-3 py-2 text-[12px] font-semibold text-indigo"
              >
                <option value="all">Status</option>
                <option value="active">Active</option>
                <option value="suspended">Restricted</option>
              </select>
              <select
                name="plan"
                defaultValue={filters.plan || ""}
                className="rounded-full border border-[#E4EBFF] bg-white px-3 py-2 text-[12px] font-semibold text-indigo"
              >
                <option value="">Plan</option>
                {planOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              {tab !== "business" ? (
                <select
                  name="kyc"
                  defaultValue={filters.kyc || "all"}
                  className="rounded-full border border-[#E4EBFF] bg-white px-3 py-2 text-[12px] font-semibold text-indigo"
                >
                  <option value="all">KYC</option>
                  <option value="verified">Verified</option>
                  <option value="pending">In review</option>
                  <option value="unverified">Not verified</option>
                  <option value="rejected">Rejected</option>
                </select>
              ) : null}
              <button
                type="submit"
                className="rounded-full bg-[#F3F6FF] px-3 py-2 text-[12px] font-semibold text-indigo hover:bg-[#EEE8FF]"
              >
                Filters
              </button>
            </form>

            {canEdit && selectedIds.length > 0 ? (
              <form
                action={actionBulkAccountUpdate}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-violet/20 bg-[#F8F5FF] px-3 py-2"
              >
                <input type="hidden" name="next" value={buildHref(basePath, { ...currentQuery, id: selected?.id })} />
                <input type="hidden" name="section" value={tab === "business" ? "business" : "influencer"} />
                {selectedIds.map((id) => (
                  <input key={id} type="hidden" name="userIds" value={id} />
                ))}
                <p className="text-[12px] font-semibold text-violet">{selectedIds.length} selected</p>
                <button
                  type="submit"
                  name="op"
                  value="suspend"
                  className="rounded-lg border border-[#E4EBFF] bg-white px-2.5 py-1 text-[12px] font-semibold text-indigo"
                >
                  Suspend
                </button>
                <button
                  type="submit"
                  name="op"
                  value="unsuspend"
                  className="rounded-lg border border-[#E4EBFF] bg-white px-2.5 py-1 text-[12px] font-semibold text-indigo"
                >
                  Restore
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="text-[12px] font-semibold text-muted hover:text-indigo"
                >
                  Clear
                </button>
              </form>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-[#E4EBFF] bg-white shadow-[0_8px_24px_rgba(17,26,90,0.04)]">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-[13px]">
                  <thead className="bg-[#F7F9FF] text-[11px] font-bold uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label="Select page"
                          checked={rows.length > 0 && rows.every((r) => selectedIds.includes(r.id))}
                          onChange={toggleAllOnPage}
                        />
                      </th>
                      <th className="px-3 py-3">{tab === "business" ? "Business" : "Influencer"}</th>
                      <th className="px-3 py-3">Role</th>
                      <th className="px-3 py-3">Plan</th>
                      <th className="px-3 py-3">KYC</th>
                      <th className="px-3 py-3">Joined</th>
                      <th className="px-3 py-3">Last active</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted">
                          No accounts match these filters.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => {
                        const active = selected?.id === row.id;
                        const kyc = kycBadge(row.identityVerified, row.kycSubmissionStatus);
                        const status = statusBadge(row.suspendedAt);
                        return (
                          <tr
                            key={row.id}
                            className={`cursor-pointer border-t border-[#EEF2FF] transition ${
                              active ? "bg-[#F5F1FF]" : "hover:bg-[#FBFBFF]"
                            }`}
                            onClick={() => go({ id: row.id, page })}
                          >
                            <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(row.id)}
                                onChange={() => toggleId(row.id)}
                                aria-label={`Select ${row.displayName}`}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2.5">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet to-blue text-[11px] font-bold text-white">
                                  {row.avatarUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={row.avatarUrl} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    initials(row.displayName)
                                  )}
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-indigo">{row.displayName}</p>
                                  <p className="truncate text-[11px] text-muted">
                                    {row.handle || row.email}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-muted">{row.role}</td>
                            <td className="px-3 py-3">
                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${planTone(row.planTier)}`}
                              >
                                {row.planTier}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              {tab === "business" ? (
                                <span className="text-muted">—</span>
                              ) : (
                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${kyc.className}`}>
                                  {kyc.text}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-muted">{row.createdAt.slice(0, 10)}</td>
                            <td className="px-3 py-3 text-muted">{row.lastActiveLabel}</td>
                            <td className="px-3 py-3">
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
                                {status.text}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-muted">
                              <IconDots size={16} />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EEF2FF] px-4 py-3 text-[12px] text-muted">
                <p>
                  Showing {from}-{to} of {total.toLocaleString()}{" "}
                  {tab === "business" ? "businesses" : tab === "all" ? "accounts" : "influencers"}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={page <= 1 || pending}
                    onClick={() => go({ page: page - 1, id: selected?.id })}
                    className="rounded-lg border border-[#E4EBFF] px-2 py-1 font-semibold disabled:opacity-40"
                  >
                    ‹
                  </button>
                  <span className="px-2 font-semibold text-indigo">
                    {page} / {pageCount}
                  </span>
                  <button
                    type="button"
                    disabled={page >= pageCount || pending}
                    onClick={() => go({ page: page + 1, id: selected?.id })}
                    className="rounded-lg border border-[#E4EBFF] px-2 py-1 font-semibold disabled:opacity-40"
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>
          </div>

          <aside className="min-w-0">
            {selected && detail ? (
              <AccountDetailPanel
                row={selected}
                detail={detail}
                detailTab={detailTab}
                setDetailTab={setDetailTab}
                canEdit={canEdit}
                planOptions={planOptions}
                roleOptions={roleOptions}
                nextPath={buildHref(basePath, { ...currentQuery, id: selected.id })}
                section={selected.role === "CREATOR" ? "influencer" : "business"}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-[#E4EBFF] bg-white p-8 text-center text-sm text-muted shadow-sm">
                Select an account row to open the profile overview, KYC tools, notes, and quick actions.
              </div>
            )}
          </aside>
        </div>
      )}

      <details className="rounded-2xl border border-[#E4EBFF] bg-white p-4 shadow-sm">
        <summary className="cursor-pointer font-display text-sm font-bold text-indigo">
          Registration policy
        </summary>
        <AccountPolicyForm
          canEdit={canEdit}
          consentVersion={policy.consentVersion}
          consentCopy={policy.consentCopy}
          passwordMinLength={policy.passwordMinLength}
          section={tab === "business" ? "business" : "influencer"}
        />
      </details>
    </div>
  );
}

function AccountDetailPanel({
  row,
  detail,
  detailTab,
  setDetailTab,
  canEdit,
  planOptions,
  roleOptions,
  nextPath,
  section,
}: {
  row: AccountTableRow;
  detail: AccountDetailExtras;
  detailTab: "overview" | "details" | "kyc" | "activity" | "billing";
  setDetailTab: (t: "overview" | "details" | "kyc" | "activity" | "billing") => void;
  canEdit: boolean;
  planOptions: string[];
  roleOptions: string[];
  nextPath: string;
  section: "influencer" | "business";
}) {
  const status = statusBadge(row.suspendedAt);
  const kyc = kycBadge(row.identityVerified, row.kycSubmissionStatus);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E4EBFF] bg-white shadow-[0_8px_24px_rgba(17,26,90,0.04)]">
      <div
        className="relative h-24 bg-gradient-to-r from-[#4B2AD9] via-[#633CFF] to-[#2979FF]"
        style={
          row.coverUrl
            ? { backgroundImage: `url(${row.coverUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
      />
      <div className="relative px-4 pb-4 pt-0">
        <div className="-mt-8 flex items-end gap-3">
          <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gradient-to-br from-violet to-blue text-sm font-bold text-white shadow">
            {row.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials(row.displayName)
            )}
          </span>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-display text-lg font-bold text-indigo">{row.displayName}</h2>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.className}`}>
                {status.text}
              </span>
            </div>
            <p className="truncate text-[12px] text-muted">
              {row.handle || row.email} · {detail.publicId}
            </p>
            <p className="truncate text-[11px] text-muted">
              {row.locationLabel} · Joined {row.createdAt.slice(0, 10)}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1 border-b border-[#EEF2FF] pb-2">
          {(
            [
              ["overview", "Overview"],
              ["details", "Details"],
              ["kyc", "KYC & Docs"],
              ["activity", "Activity"],
              ["billing", "Billing"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setDetailTab(id)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                detailTab === id ? "bg-[#EEE8FF] text-violet" : "text-muted hover:text-indigo"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {detailTab === "overview" ? (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <StatMini label="Followers" value={formatFollowers(row.followers)} />
              <StatMini label="Engagement" value={row.engagementRate || "—"} />
              <StatMini label="Collaborations" value={String(row.collaborations)} />
              <StatMini label="Earnings" value={`${money(row.earningsYtdCents)} YTD`} />
            </div>

            <div className="space-y-2 rounded-xl bg-[#F7F9FF] p-3 text-[12px]">
              <RowLink label="Current plan" value={row.planTier} href="#account-edit" />
              <RowLink
                label="KYC status"
                value={kyc.text}
                href={row.creatorSlug ? "/admin/kyc" : undefined}
                linkLabel={row.creatorSlug ? "View documents" : undefined}
              />
              <RowLink
                label="Account status"
                value={status.text}
                href="#account-edit"
                linkLabel={row.suspendedAt ? "Restore" : "Suspend"}
              />
              <RowLink label="Role" value={row.role} href="#account-edit" linkLabel="Edit role" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`mailto:${row.email}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4EBFF] bg-white px-3 py-2 text-[12px] font-semibold text-indigo"
              >
                <IconMail size={14} /> Message
              </Link>
              <Link
                href="/admin/invitations"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4EBFF] bg-white px-3 py-2 text-[12px] font-semibold text-indigo"
              >
                Send invite
              </Link>
              {canEdit ? (
                <form action={actionSendPasswordReset}>
                  <input type="hidden" name="userId" value={row.id} />
                  <input type="hidden" name="next" value={nextPath} />
                  <input type="hidden" name="section" value={section} />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#F1ECFF] px-3 py-2 text-[12px] font-semibold text-violet"
                  >
                    Reset password
                  </button>
                </form>
              ) : null}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-bold text-indigo">Recent activity</p>
                <button
                  type="button"
                  onClick={() => setDetailTab("activity")}
                  className="text-[11px] font-semibold text-violet"
                >
                  View all
                </button>
              </div>
              <ul className="mt-2 space-y-2">
                {detail.activity.length === 0 ? (
                  <li className="text-[12px] text-muted">No audited activity yet.</li>
                ) : (
                  detail.activity.slice(0, 4).map((item) => (
                    <li key={item.id} className="flex gap-2 text-[12px]">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet" />
                      <div className="min-w-0">
                        <p className="font-semibold text-indigo">{item.title}</p>
                        <p className="text-muted">
                          {item.detail} · {new Date(item.at).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        ) : null}

        {detailTab === "details" ? (
          <div id="account-edit" className="mt-4 space-y-4">
            <form action={actionSaveMember} className="space-y-3">
              <input type="hidden" name="userId" value={row.id} />
              <input type="hidden" name="next" value={nextPath} />
              <input type="hidden" name="section" value={section} />
              <label className="block text-[11px] font-bold uppercase tracking-wide text-muted">
                Role
                <select
                  name="role"
                  defaultValue={row.role}
                  disabled={!canEdit}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-indigo"
                >
                  {[...new Set([row.role, ...roleOptions])].map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-muted">
                Plan
                <select
                  name="planTier"
                  defaultValue={row.planTier}
                  disabled={!canEdit}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-indigo"
                >
                  {[...new Set([row.planTier, ...planOptions])].map((plan) => (
                    <option key={plan} value={plan}>
                      {plan}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
                <input
                  type="checkbox"
                  name="suspended"
                  value="1"
                  defaultChecked={Boolean(row.suspendedAt)}
                  disabled={!canEdit}
                />
                Suspended / restricted
              </label>
              <p className="text-[11px] text-muted">
                Email: {row.emailVerifiedAt ? `Verified ${row.emailVerifiedAt.slice(0, 10)}` : "Not verified"}{" "}
                (member-owned). Password: {row.passwordHash ? "Set" : "Not set"}.
              </p>
              {row.contactLabel ? (
                <p className="text-[11px] text-muted">Business contact: {row.contactLabel}</p>
              ) : null}
              {canEdit ? (
                <button type="submit" className="btn-primary w-full">
                  Save account
                </button>
              ) : null}
            </form>

            {canEdit ? (
              <form action={actionAddAccountNote} className="space-y-2 border-t border-[#EEF2FF] pt-3">
                <input type="hidden" name="userId" value={row.id} />
                <input type="hidden" name="next" value={nextPath} />
                <input type="hidden" name="section" value={section} />
                <p className="text-[12px] font-bold text-indigo">Internal admin notes</p>
                <textarea
                  name="note"
                  required
                  rows={3}
                  placeholder="Visible only to admins…"
                  className="w-full rounded-xl border border-border px-3 py-2 text-sm"
                />
                <button type="submit" className="rounded-xl bg-[#F1ECFF] px-3 py-2 text-[12px] font-semibold text-violet">
                  Add note
                </button>
                <ul className="space-y-2">
                  {detail.notes.map((n) => (
                    <li key={n.id} className="rounded-lg bg-[#F7F9FF] px-3 py-2 text-[12px]">
                      <p className="text-indigo">{n.note}</p>
                      <p className="mt-1 text-[10px] text-muted">
                        {n.actor} · {new Date(n.at).toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              </form>
            ) : null}
          </div>
        ) : null}

        {detailTab === "kyc" ? (
          <div className="mt-4 space-y-3">
            <p className={`text-sm font-semibold ${kyc.className.replace("bg-", " ").trim()}`}>
              Identity: {kyc.text}
            </p>
            <p className="text-[12px] text-muted">
              {row.kycSubmissionStatus
                ? `Submission: ${row.kycSubmissionStatus}`
                : "No document or gateway submission on file."}
            </p>
            {row.creatorSlug ? (
              <Link href="/admin/kyc" className="inline-flex items-center gap-1 text-[12px] font-semibold text-violet">
                Open KYC queue <IconArrowRight size={12} />
              </Link>
            ) : (
              <p className="text-[12px] text-muted">KYC applies to influencer profiles.</p>
            )}
            {canEdit && row.creatorSlug ? (
              <form action={actionSetInfluencerIdentityKyc} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="userId" value={row.id} />
                <input type="hidden" name="creatorSlug" value={row.creatorSlug} />
                <input type="hidden" name="next" value={nextPath} />
                <input type="hidden" name="section" value="influencer" />
                <label className="text-[11px] font-bold uppercase text-muted">
                  Decision
                  <select
                    name="decision"
                    defaultValue="verified"
                    className="mt-1 rounded-xl border border-border px-3 py-2 text-sm text-indigo"
                  >
                    <option value="verified">Mark verified</option>
                    <option value="rejected">Mark rejected</option>
                  </select>
                </label>
                <button type="submit" className="rounded-xl border border-[#E4EBFF] px-3 py-2 text-[12px] font-semibold">
                  Update identity
                </button>
              </form>
            ) : null}
          </div>
        ) : null}

        {detailTab === "activity" ? (
          <ul className="mt-4 space-y-3">
            {detail.activity.length === 0 ? (
              <li className="text-[12px] text-muted">No audited account activity yet.</li>
            ) : (
              detail.activity.map((item) => (
                <li key={item.id} className="border-b border-[#EEF2FF] pb-2 text-[12px]">
                  <p className="font-semibold text-indigo">{item.title}</p>
                  <p className="text-muted">
                    {item.detail} · {new Date(item.at).toLocaleString()}
                  </p>
                </li>
              ))
            )}
          </ul>
        ) : null}

        {detailTab === "billing" ? (
          <div className="mt-4 space-y-3 text-[12px]">
            <div className="rounded-xl bg-[#F7F9FF] p-3">
              <p className="font-semibold text-indigo">Plan</p>
              <p className="mt-1 text-muted">{row.planTier}</p>
              <Link href="/admin/billing" className="mt-2 inline-flex font-semibold text-violet">
                Open billing console
              </Link>
            </div>
            <div className="rounded-xl bg-[#F7F9FF] p-3">
              <p className="font-semibold text-indigo">Earnings YTD</p>
              <p className="mt-1 flex items-center gap-1 font-display text-lg font-bold text-indigo">
                <IconWallet size={16} /> {money(row.earningsYtdCents)}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#E4EBFF] bg-[#FBFBFF] p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-base font-bold text-indigo">{value}</p>
    </div>
  );
}

function RowLink({
  label,
  value,
  href,
  linkLabel,
}: {
  label: string;
  value: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div>
        <p className="text-muted">{label}</p>
        <p className="font-semibold text-indigo">{value}</p>
      </div>
      {href && linkLabel ? (
        <Link href={href} className="shrink-0 font-semibold text-violet hover:underline">
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

function AdminAccountsPanel({
  rows,
  roles,
  canManage,
}: {
  rows: AdminConsoleRow[];
  roles: { id: string; name: string }[];
  canManage: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          Console operators (AdminUser). Role permissions are edited on Access levels.
        </p>
        <Link href="/admin/access" className="text-[12px] font-semibold text-violet hover:underline">
          Open Access levels →
        </Link>
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#E4EBFF] bg-white shadow-sm">
        <table className="min-w-full text-left text-[13px]">
          <thead className="bg-[#F7F9FF] text-[11px] font-bold uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Admin</th>
              <th className="px-4 py-3">Access level</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[#EEF2FF]">
                <td className="px-4 py-3">
                  <p className="font-semibold text-indigo">{row.name}</p>
                  <p className="text-[11px] text-muted">{row.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-[#EEE8FF] px-2 py-0.5 text-[11px] font-semibold text-violet">
                    {row.roleName}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      row.active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"
                    }`}
                  >
                    {row.active ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{row.createdAt.slice(0, 10)}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <Link href="/admin/access" className="text-[12px] font-semibold text-violet">
                      Manage
                    </Link>
                  ) : (
                    <span className="text-[12px] text-muted">View only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {roles.length ? (
        <p className="text-[11px] text-muted">
          {roles.length} access level{roles.length === 1 ? "" : "s"} defined · create admins on Access
          levels.
        </p>
      ) : null}
      <div className="flex items-center gap-2 text-[12px] text-muted">
        <IconCheck size={14} className="text-emerald-600" />
        Same design language as member accounts — manage operators without leaving Account Management.
      </div>
    </div>
  );
}
