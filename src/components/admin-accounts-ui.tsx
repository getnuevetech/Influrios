"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  actionAddAccountNote,
  actionBulkAccountUpdate,
  actionSaveMember,
  actionSendPasswordReset,
  actionSetInfluencerIdentityKyc,
} from "@/app/admin/accounts/actions";
import { AccountPolicyForm } from "@/app/admin/accounts/account-section";
import { ContactAddressFields } from "@/components/contact-address-fields";
import { PlaceFields } from "@/components/place-fields";
import type {
  AccountDetailExtras,
  AccountKpis,
  AccountTableRow,
  AccountsTab,
} from "@/lib/admin-accounts";
import {
  IconArrowRight,
  IconBuilding,
  IconIdCard,
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

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
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
  flash,
  policy,
  initialEditing = false,
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
    email?: string;
    phone?: string;
    handle?: string;
    status?: string;
    plan?: string;
    kyc?: string;
  };
  selected: AccountTableRow | null;
  detail: AccountDetailExtras | null;
  planOptions: string[];
  roleOptions: string[];
  canEdit: boolean;
  flash: { saved?: string; error?: string; reset?: string };
  policy: { consentVersion: string; consentCopy: string; passwordMinLength: number };
  initialEditing?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailTab, setDetailTab] = useState<"overview" | "profile" | "verification" | "billing" | "activity">(
    "overview",
  );
  const [editing, setEditing] = useState(initialEditing);
  const [moreFilters, setMoreFilters] = useState(Boolean(filters.email || filters.phone || filters.handle));

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const currentQuery = useMemo(
    () => ({
      tab: tab === "influencer" || tab === "business" ? undefined : tab,
      q: filters.q,
      email: filters.email,
      phone: filters.phone,
      handle: filters.handle,
      status: filters.status,
      plan: filters.plan,
      kyc: filters.kyc,
      page: page > 1 ? page : undefined,
    }),
    [tab, filters, page],
  );

  function go(patch: Record<string, string | number | undefined | null>) {
    startTransition(() => {
      router.push(buildHref(basePath, { ...currentQuery, ...patch }), { scroll: false });
    });
  }

  useEffect(() => {
    setEditing(initialEditing);
    setDetailTab("overview");
  }, [selected?.id, initialEditing]);

  useEffect(() => {
    if (!selected) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [selected]);

  function toggleId(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAllOnPage() {
    const ids = rows.map((r) => r.id);
    setSelectedIds((prev) => (ids.every((id) => prev.includes(id)) ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]));
  }

  const exportHref = `/admin/accounts/export?tab=${tab}${filters.q ? `&q=${encodeURIComponent(filters.q)}` : ""}${
    filters.email ? `&email=${encodeURIComponent(filters.email)}` : ""
  }${filters.phone ? `&phone=${encodeURIComponent(filters.phone)}` : ""}${
    filters.handle ? `&handle=${encodeURIComponent(filters.handle)}` : ""
  }${filters.status && filters.status !== "all" ? `&status=${filters.status}` : ""}`;

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

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["influencer", "Influencer Accounts", "/admin/accounts"],
            ["business", "Business Accounts", "/admin/business-accounts"],
            ["all", "All Accounts", "/admin/accounts?tab=all"],
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
        <Link
          href="/admin/admin-users"
          className="rounded-full border border-dashed border-[#E4EBFF] px-4 py-2 text-[13px] font-semibold text-violet hover:border-violet/40"
        >
          Admin users →
        </Link>
      </div>

      <div className="min-w-0 space-y-3">
            <form
              className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#E4EBFF] bg-white p-3 shadow-sm"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                go({
                  q: String(fd.get("q") || "") || undefined,
                  email: String(fd.get("email") || "") || undefined,
                  phone: String(fd.get("phone") || "") || undefined,
                  handle: String(fd.get("handle") || "") || undefined,
                  status: String(fd.get("status") || "all"),
                  plan: String(fd.get("plan") || "") || undefined,
                  kyc: String(fd.get("kyc") || "all"),
                  page: 1,
                  view: undefined,
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
                  placeholder="Search name, email, handle, or ID"
                  className="w-full rounded-full border border-[#E4EBFF] bg-[#F7F9FF] py-2 pl-9 pr-3 text-[13px] outline-none focus:border-violet focus:bg-white"
                />
              </label>
              <button
                type="button"
                onClick={() => setMoreFilters((value) => !value)}
                className="rounded-full border border-[#E4EBFF] bg-white px-3 py-2 text-[12px] font-semibold text-indigo"
              >
                More
              </button>
              {moreFilters ? (
                <>
                  <input
                    name="handle"
                    defaultValue={filters.handle || ""}
                    placeholder="Handle"
                    className="w-36 rounded-full border border-[#E4EBFF] bg-white px-3 py-2 text-[12px] outline-none focus:border-violet"
                  />
                  <input
                    name="email"
                    defaultValue={filters.email || ""}
                    placeholder="Email"
                    className="w-44 rounded-full border border-[#E4EBFF] bg-white px-3 py-2 text-[12px] outline-none focus:border-violet"
                  />
                  <input
                    name="phone"
                    defaultValue={filters.phone || ""}
                    placeholder="Mobile"
                    className="w-36 rounded-full border border-[#E4EBFF] bg-white px-3 py-2 text-[12px] outline-none focus:border-violet"
                  />
                </>
              ) : (
                <>
                  <input type="hidden" name="handle" value={filters.handle || ""} />
                  <input type="hidden" name="email" value={filters.email || ""} />
                  <input type="hidden" name="phone" value={filters.phone || ""} />
                </>
              )}
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
                <input type="hidden" name="next" value={buildHref(basePath, { ...currentQuery, view: selected?.id })} />
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
                      <th className="px-3 py-3">Account name</th>
                      <th className="px-3 py-3">Type</th>
                      <th className="px-3 py-3">Plan</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">
                          No accounts match these filters.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => {
                        const active = selected?.id === row.id;
                        const status = statusBadge(row.suspendedAt);
                        const typeLabel = row.role === "BUSINESS" || row.role === "AGENCY" ? "Business" : "Influencer";
                        return (
                          <tr
                            key={row.id}
                            className={`border-t border-[#EEF2FF] transition ${
                              active ? "bg-[#F5F1FF]" : "hover:bg-[#FBFBFF]"
                            }`}
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
                                  <p className="truncate text-[11px] text-muted">{row.handle || "Handle on the account record"}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-[#344054]">{typeLabel}</td>
                            <td className="px-3 py-3 text-[#344054]">{row.planTier || "—"}</td>
                            <td className="px-3 py-3">
                              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>
                                {status.text}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => go({ view: row.id })}
                                  className="rounded-full border border-[#E4EBFF] bg-white px-3 py-1.5 text-[12px] font-semibold text-violet"
                                >
                                  View account
                                </button>
                                <details className="relative">
                                  <summary className="cursor-pointer list-none rounded-full border border-[#E4EBFF] px-2 py-1 text-[12px] font-bold text-muted">
                                    ···
                                  </summary>
                                  <div className="absolute right-0 z-10 mt-1 w-44 rounded-xl border border-[#E4EBFF] bg-white p-1 shadow-lg">
                                    <a href={`mailto:${row.email}`} className="block rounded-lg px-3 py-2 text-[12px] font-semibold text-indigo hover:bg-[#F7F8FF]">
                                      Email
                                    </a>
                                    {canEdit ? (
                                      <button
                                        type="button"
                                        onClick={() => go({ view: row.id, mode: "edit" })}
                                        className="block w-full rounded-lg px-3 py-2 text-left text-[12px] font-semibold text-indigo hover:bg-[#F7F8FF]"
                                      >
                                        Edit account
                                      </button>
                                    ) : null}
                                  </div>
                                </details>
                              </div>
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
                    onClick={() => go({ page: page - 1, view: selected?.id })}
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
                    onClick={() => go({ page: page + 1, view: selected?.id })}
                    className="rounded-lg border border-[#E4EBFF] px-2 py-1 font-semibold disabled:opacity-40"
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>
          </div>

      {selected && detail ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close account"
            className="absolute inset-0 bg-[#0E1440]/45"
            onClick={() => go({ view: undefined, mode: undefined })}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-edit-title"
            className="absolute inset-0 flex flex-col overflow-hidden bg-white sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(90vh,840px)] sm:w-[min(880px,calc(100%-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:shadow-[0_24px_80px_rgba(17,26,90,0.18)]"
          >
            <AccountDetailPanel
              row={selected}
              detail={detail}
              detailTab={detailTab}
              setDetailTab={setDetailTab}
              editing={editing}
              setEditing={setEditing}
              onClose={() => go({ view: undefined })}
              canEdit={canEdit}
              planOptions={planOptions}
              roleOptions={roleOptions}
              nextPath={buildHref(basePath, { ...currentQuery, view: selected.id })}
              section={selected.role === "CREATOR" ? "influencer" : "business"}
            />
          </div>
        </div>
      ) : null}

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
  editing,
  setEditing,
  onClose,
  canEdit,
  planOptions,
  roleOptions,
  nextPath,
  section,
}: {
  row: AccountTableRow;
  detail: AccountDetailExtras;
  detailTab: "overview" | "profile" | "verification" | "billing" | "activity";
  setDetailTab: (t: "overview" | "profile" | "verification" | "billing" | "activity") => void;
  editing: boolean;
  setEditing: (value: boolean) => void;
  onClose: () => void;
  canEdit: boolean;
  planOptions: string[];
  roleOptions: string[];
  nextPath: string;
  section: "influencer" | "business";
}) {
  const status = statusBadge(row.suspendedAt);
  const kyc = kycBadge(row.identityVerified, row.kycSubmissionStatus);
  const tabs = [
    ["overview", "Overview"],
    ["profile", "Profile"],
    ["verification", "Verification"],
    ["billing", "Billing"],
    ["activity", "Activity"],
  ] as const;

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-[#EEF2FF] px-5 py-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">User account</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet to-blue text-sm font-bold text-white">
              {row.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={row.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                initials(row.displayName)
              )}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="account-edit-title" className="truncate font-display text-lg font-bold text-indigo">
                  {row.displayName}
                </h2>
                <span className="rounded-full bg-[#F1ECFF] px-2 py-0.5 text-[10px] font-bold text-violet">
                  {roleLabel(row.role)}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${status.className}`}>{status.text}</span>
              </div>
              <p className="truncate text-[12px] text-muted">
                {row.handle || "No handle"} · {detail.publicId}
              </p>
            </div>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full px-2 py-1 text-lg text-muted">
          ×
        </button>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-[#EEF2FF] px-5">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setEditing(false);
              setDetailTab(id);
            }}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-[13px] font-semibold ${
              !editing && detailTab === id ? "border-violet text-violet" : "border-transparent text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">

        {!editing && detailTab === "overview" ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <section className="rounded-2xl border border-[#E4EBFF] p-4">
                <p className="text-[13px] font-bold text-indigo">Contact details</p>
                <dl className="mt-3 space-y-2 text-[13px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Email</dt>
                    <dd className="truncate text-right text-indigo">{row.email}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Mobile</dt>
                    <dd className="text-right text-indigo">{accountPhones(row).join(", ") || "Not provided"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Location</dt>
                    <dd className="text-right text-indigo">{row.locationLabel || "Not provided"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Joined</dt>
                    <dd className="text-right text-indigo">{row.createdAt.slice(0, 10)}</dd>
                  </div>
                </dl>
              </section>
              <section className="rounded-2xl border border-[#E4EBFF] p-4">
                <p className="text-[13px] font-bold text-indigo">Account status</p>
                <dl className="mt-3 space-y-2 text-[13px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Status</dt>
                    <dd className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>{status.text}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Plan</dt>
                    <dd className="text-indigo">{row.planTier}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Email verification</dt>
                    <dd className="text-indigo">{row.emailVerifiedAt ? "Verified" : "Not verified"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Identity (KYC)</dt>
                    <dd className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${kyc.className}`}>{kyc.text}</dd>
                  </div>
                </dl>
              </section>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <section className="rounded-2xl border border-[#E4EBFF] p-4">
                <p className="text-[13px] font-bold text-indigo">Account tools</p>
                <div className="mt-3 flex flex-col items-start gap-2">
                  {row.creatorSlug ? (
                    <Link href={`/creators/${row.creatorSlug}`} className="text-[13px] font-semibold text-violet">
                      View public profile
                    </Link>
                  ) : null}
                  {canEdit ? (
                    <form action={actionSendPasswordReset}>
                      <input type="hidden" name="userId" value={row.id} />
                      <input type="hidden" name="next" value={nextPath} />
                      <input type="hidden" name="section" value={section} />
                      <button type="submit" className="text-[13px] font-semibold text-violet">
                        Send password reset
                      </button>
                    </form>
                  ) : null}
                </div>
              </section>

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
          </div>
        ) : null}

        {editing ? (
          <div id="account-edit" className="space-y-4">
            <form id="account-edit-form" action={actionSaveMember} className="space-y-3">
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
              <label className="block text-[11px] font-bold uppercase tracking-wide text-muted">
                Account mobile
                <input
                  name="phone"
                  defaultValue={row.phone || ""}
                  disabled={!canEdit}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-indigo"
                />
              </label>
              {canEdit ? (
                <>
                  <ContactAddressFields
                    defaultLine1={row.addressLine1 || ""}
                    defaultLine2={row.addressLine2 || ""}
                    defaultPostal={row.postalCode || ""}
                  />
                  <PlaceFields
                    cityName="city"
                    stateName="state"
                    countryName="country"
                    defaultCity={row.city || ""}
                    defaultState={row.state || ""}
                    defaultCountry={row.country || ""}
                  />
                  {section === "business" ? (
                    <>
                      <label className="block text-[11px] font-bold uppercase tracking-wide text-muted">
                        Contact name
                        <input
                          name="contactName"
                          defaultValue={row.contactName || ""}
                          className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-indigo"
                        />
                      </label>
                      <label className="block text-[11px] font-bold uppercase tracking-wide text-muted">
                        Contact email
                        <input
                          name="contactEmail"
                          type="email"
                          defaultValue={row.contactEmail || ""}
                          className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-indigo"
                        />
                      </label>
                      <label className="block text-[11px] font-bold uppercase tracking-wide text-muted">
                        Contact mobile
                        <input
                          name="contactPhone"
                          defaultValue={row.contactPhone || ""}
                          className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal text-indigo"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm font-semibold text-indigo">
                        <input
                          type="checkbox"
                          name="countryVerified"
                          value="1"
                          defaultChecked={Boolean(row.verifiedCountryCode)}
                        />
                        Funding country verified
                      </label>
                      <label className="block text-[11px] font-bold uppercase tracking-wide text-muted">
                        Verified funding country
                        <input
                          name="verifiedCountryCode"
                          defaultValue={row.verifiedCountryCode || ""}
                          maxLength={2}
                          placeholder="US"
                          className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm font-normal uppercase text-indigo"
                        />
                      </label>
                      <p className="text-[11px] text-muted">The mailing country is not used for funding. Enter the two-letter country only after it is verified.</p>
                    </>
                  ) : null}
                </>
              ) : null}
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
                Login email {row.email} is {row.emailVerifiedAt ? `verified ${row.emailVerifiedAt.slice(0, 10)}` : "not verified"}.
                Password: {row.passwordHash ? "Set" : "Not set"}.
              </p>
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

        {!editing && detailTab === "profile" ? (
          <div className="space-y-4">
            <AccountFacts row={row} publicId={detail.publicId} />
          </div>
        ) : null}

        {!editing && detailTab === "verification" ? (
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

        {!editing && detailTab === "activity" ? (
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

        {!editing && detailTab === "billing" ? (
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
      <div className="flex justify-end gap-2 border-t border-[#EEF2FF] px-5 py-4">
        {editing ? (
          <>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full border border-[#E4EBFF] px-4 py-2 text-[13px] font-semibold text-indigo"
            >
              Cancel
            </button>
            {canEdit ? (
              <button type="submit" form="account-edit-form" className="rounded-full bg-violet px-4 py-2 text-[13px] font-semibold text-white">
                Save
              </button>
            ) : null}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[#E4EBFF] px-4 py-2 text-[13px] font-semibold text-indigo"
            >
              Close
            </button>
            {canEdit ? (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-full bg-violet px-4 py-2 text-[13px] font-semibold text-white"
              >
                Edit account
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function roleLabel(role: string) {
  if (role === "CREATOR") return "Influencer";
  if (role === "BUSINESS") return "Business";
  if (role === "AGENCY") return "Agency";
  return role;
}

function accountPhones(row: AccountTableRow) {
  return [row.phone, row.contactPhone].filter((phone, index, all): phone is string =>
    Boolean(phone) && all.indexOf(phone) === index,
  );
}

function AccountFacts({ row, publicId }: { row: AccountTableRow; publicId: string }) {
  const facts: Array<[string, string]> = [
    ["Login email", row.email],
    ["Mobile", row.phone || "Not set"],
    ["Preferred contact", row.preferredCommChannel],
    ["Email verified", row.emailVerifiedAt ? row.emailVerifiedAt.slice(0, 10) : "Not verified"],
    ["Password", row.passwordHash ? "Set" : "Not set"],
    ["Account id", row.id],
    ["Public id", publicId],
    ["Legal name", row.name || "Not set"],
    ["Display name", row.displayName],
    ["Handle", row.handle || "Not set"],
    ["Role", row.role],
    ["Plan", row.planTier],
    ["Street", row.addressLine1 || "Not set"],
    ["Address line 2", row.addressLine2 || "Not set"],
    ["City", row.city || "Not set"],
    ["State", row.state || "Not set"],
    ["Country", row.country || "Not set"],
    ["Postal code", row.postalCode || "Not set"],
    ["Location", row.locationLabel],
    ["Status", row.suspendedAt ? `Restricted ${row.suspendedAt.slice(0, 10)}` : "Active"],
    ["Joined", row.createdAt.slice(0, 10)],
    ["Last updated", row.updatedAt.slice(0, 10)],
    ["Consent", row.consentVersion || "Not recorded"],
    ["Stripe customer", row.stripeCustomerId || "Not set"],
    ["Business name", row.businessName || "Not set"],
    ["Industry", row.businessIndustry || "Not set"],
    ["Business geography", row.businessGeography || "Not set"],
    ["Verified funding country", row.verifiedCountryCode || "Not verified"],
    ["Business contact", row.contactName || "Not set"],
    ["Business email", row.contactEmail || "Not set"],
    ["Business mobile", row.contactPhone || "Not set"],
  ];
  return (
    <dl className="grid grid-cols-1 gap-2 rounded-xl border border-[#E4EBFF] p-3 sm:grid-cols-2">
      {facts.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</dt>
          <dd className="truncate text-[12px] font-semibold text-indigo" title={value}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
