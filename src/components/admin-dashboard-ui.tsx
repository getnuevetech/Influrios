"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AdminDashboardData, KpiCard, Trend } from "@/lib/admin-dashboard";
import {
  IconArrowRight,
  IconBuilding,
  IconCheck,
  IconFileText,
  IconGlobe,
  IconHandshake,
  IconIdCard,
  IconImage,
  IconLink,
  IconMail,
  IconShieldPay,
  IconUser,
  IconUsers,
  IconWallet,
} from "@/components/icons";

function formatTrend(trend: Trend, invertGood = false) {
  if (trend.pct == null || trend.up == null) {
    return { text: "—", className: "text-muted" };
  }
  const improved = invertGood ? !trend.up : trend.up;
  const arrow = trend.up ? "↑" : "↓";
  return {
    text: `${arrow} ${Math.abs(trend.pct)}%`,
    className: improved ? "text-emerald-600" : "text-rose-500",
  };
}

function Sparkline({ values, stroke = "#633CFF" }: { values: number[]; stroke?: string }) {
  const points = useMemo(() => {
    if (!values.length) return "";
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const span = Math.max(max - min, 1);
    return values
      .map((v, i) => {
        const x = values.length === 1 ? 0 : (i / (values.length - 1)) * 100;
        const y = 28 - ((v - min) / span) * 24;
        return `${x},${y}`;
      })
      .join(" ");
  }, [values]);
  return (
    <svg viewBox="0 0 100 32" className="h-8 w-full" aria-hidden>
      <polyline fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

function KpiIcon({ kpi }: { kpi: KpiCard }) {
  const wrap =
    kpi.tone === "blue"
      ? "bg-[#E8F1FF] text-blue"
      : kpi.tone === "green"
        ? "bg-emerald-50 text-emerald-600"
        : kpi.tone === "amber"
          ? "bg-amber-50 text-amber-600"
          : kpi.tone === "rose"
            ? "bg-rose-50 text-rose-500"
            : "bg-[#EEE8FF] text-violet";
  const Icon =
    kpi.key === "businesses"
      ? IconBuilding
      : kpi.key === "collabs"
        ? IconHandshake
        : kpi.key === "volume"
          ? IconWallet
          : kpi.key === "kyc"
            ? IconIdCard
            : kpi.key === "disputes"
              ? IconShieldPay
              : IconUsers;
  return (
    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${wrap}`}>
      <Icon size={16} />
    </span>
  );
}

function HealthIcon({ healthKey }: { healthKey: string }) {
  const Icon =
    healthKey === "payment"
      ? IconWallet
      : healthKey === "email"
        ? IconMail
        : healthKey === "ai"
          ? IconGlobe
          : healthKey === "shortlinks"
            ? IconLink
            : healthKey === "signing"
              ? IconFileText
              : healthKey === "marketplace"
                ? IconHandshake
                : IconShieldPay;
  return (
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F3F6FF] text-violet">
      <Icon size={14} />
    </span>
  );
}

function relativeTime(at: Date) {
  const ms = Date.now() - new Date(at).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

function GrowthChart({
  points,
}: {
  points: AdminDashboardData["growth"];
}) {
  const w = 520;
  const h = 200;
  const pad = { t: 16, r: 12, b: 28, l: 12 };
  const max = Math.max(1, ...points.flatMap((p) => [p.influencers, p.businesses]));
  const x = (i: number) => pad.l + (i / Math.max(points.length - 1, 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (h - pad.t - pad.b);
  const line = (key: "influencers" | "businesses") =>
    points.map((p, i) => `${x(i)},${y(p[key])}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[200px] w-full" role="img" aria-label="Signups chart">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={pad.l}
          x2={w - pad.r}
          y1={y(max * f)}
          y2={y(max * f)}
          stroke="#E8EEFB"
          strokeWidth="1"
        />
      ))}
      <polyline fill="none" stroke="#633CFF" strokeWidth="2.5" strokeLinejoin="round" points={line("influencers")} />
      <polyline fill="none" stroke="#2979FF" strokeWidth="2.5" strokeLinejoin="round" points={line("businesses")} />
      {points.map((p, i) => (
        <text key={p.key} x={x(i)} y={h - 8} textAnchor="middle" className="fill-muted text-[10px]">
          {p.label}
        </text>
      ))}
    </svg>
  );
}

function BarChart({ bars }: { bars: { label: string; value: number }[] }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="flex h-[180px] items-end gap-2">
      {bars.map((b) => (
        <div key={b.label} className="flex flex-1 flex-col items-center gap-2">
          <div
            className="w-full rounded-t-lg bg-gradient-to-t from-[#4B2AD9] to-[#9B7CFF]"
            style={{ height: `${Math.max(8, (b.value / max) * 140)}px` }}
            title={`${b.label}: ${b.value}`}
          />
          <span className="text-[10px] font-medium text-muted">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

function Donut({
  slices,
  centerValue,
}: {
  slices: AdminDashboardData["categories"];
  centerValue: string;
}) {
  const colors = ["#633CFF", "#2979FF", "#8B5CF6", "#38BDF8", "#CBD5E1"];
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const total = slices.reduce((s, x) => s + x.pct, 0) || 100;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#EEF2FF" strokeWidth="14" />
        {slices.map((s, i) => {
          const len = (s.pct / total) * c;
          const el = (
            <circle
              key={s.label}
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth="14"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
            />
          );
          offset += len;
          return el;
        })}
        <text x="60" y="56" textAnchor="middle" className="fill-indigo text-[12px] font-bold">
          {centerValue}
        </text>
        <text x="60" y="70" textAnchor="middle" className="fill-muted text-[8px]">
          active
        </text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5 text-[12px]">
        {slices.map((s, i) => (
          <li key={s.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 truncate text-indigo">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: colors[i % colors.length] }}
              />
              {s.label}
            </span>
            <span className="font-semibold text-muted">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const QUICK: { href: string; label: string; icon: typeof IconUser }[] = [
  { href: "/admin/kyc", label: "Review KYC", icon: IconIdCard },
  { href: "/admin/business-accounts", label: "Approve Business", icon: IconBuilding },
  { href: "/admin/banners", label: "Create Banner", icon: IconImage },
  { href: "/admin/homepage", label: "Publish Content", icon: IconFileText },
  { href: "/admin/marketplace", label: "Check Ledger", icon: IconWallet },
  { href: "/admin/access", label: "Manage Access Levels", icon: IconShieldPay },
];

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function AdminPlatformOverview({
  data,
  forbidden,
}: {
  data: AdminDashboardData;
  forbidden?: boolean;
}) {
  const [growthTab, setGrowthTab] = useState<"signups" | "collaborations" | "revenue">("signups");
  const growthTrend = formatTrend(data.growthTrend);
  const collabTrend = formatTrend(data.collabTrend);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet">Admin Dashboard</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-indigo">Platform Overview</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-muted">
            Welcome back, {data.sessionName}. Here’s what’s happening across Influrios today.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#E4EBFF] bg-white px-3 py-1.5 text-[12px] font-semibold text-indigo shadow-sm">
            <IconCalendarMini />
            {data.rangeLabel}
            <span className="text-muted">▾</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-700">
            <IconCheck size={14} />
            Signed in as {data.sessionRole} ({data.sessionEmail})
          </span>
        </div>
      </div>

      {forbidden ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You don’t have permission for that admin feature. Ask a Super Admin to update your access
          level.
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {data.kpis.map((kpi) => {
          const invert = kpi.key === "kyc" || kpi.key === "disputes";
          const trend = formatTrend(kpi.trend, invert);
          const stroke =
            kpi.tone === "blue"
              ? "#2979FF"
              : kpi.tone === "green"
                ? "#10B981"
                : kpi.tone === "amber"
                  ? "#D97706"
                  : kpi.tone === "rose"
                    ? "#F43F5E"
                    : "#633CFF";
          return (
            <Link
              key={kpi.key}
              href={kpi.href}
              className="rounded-2xl border border-[#E4EBFF] bg-white p-4 shadow-[0_8px_24px_rgba(17,26,90,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(99,60,255,0.08)]"
              style={{ borderBottomWidth: 3, borderBottomColor: stroke }}
            >
              <div className="flex items-start justify-between gap-2">
                <KpiIcon kpi={kpi} />
              </div>
              <p className="mt-3 text-[12px] font-semibold text-muted">{kpi.label}</p>
              <p className="mt-1 font-display text-2xl font-bold text-indigo">{kpi.value}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className={`text-[11px] font-semibold ${trend.className}`}>
                  {trend.text}
                  <span className="ml-1 font-medium text-muted">vs. previous 30 days</span>
                </p>
              </div>
              <div className="mt-2">
                <Sparkline values={kpi.spark} stroke={stroke} />
              </div>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <div className="rounded-2xl border border-[#E4EBFF] bg-white p-5 shadow-[0_8px_24px_rgba(17,26,90,0.04)] xl:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-indigo">Platform Growth</h2>
              <p className="text-[12px] text-muted">Signups (Last 6 Months)</p>
            </div>
            <div className="flex rounded-full bg-[#F3F6FF] p-1 text-[12px] font-semibold">
              {(
                [
                  ["signups", "Signups"],
                  ["collaborations", "Collaborations"],
                  ["revenue", "Revenue"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setGrowthTab(id)}
                  className={`rounded-full px-3 py-1.5 ${
                    growthTab === id ? "bg-white text-violet shadow-sm" : "text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <p className="font-display text-3xl font-bold text-indigo">
              {new Intl.NumberFormat("en-US").format(data.growthTotal)}
            </p>
            <p className={`pb-1 text-sm font-semibold ${growthTrend.className}`}>{growthTrend.text} growth</p>
          </div>
          <div className="mt-2 flex gap-4 text-[11px] font-semibold">
            <span className="inline-flex items-center gap-1.5 text-violet">
              <span className="h-2 w-2 rounded-full bg-violet" /> Influencer signups
            </span>
            <span className="inline-flex items-center gap-1.5 text-blue">
              <span className="h-2 w-2 rounded-full bg-blue" /> Business signups
            </span>
          </div>
          <div className="mt-3">
            {growthTab === "collaborations" ? (
              <BarChart bars={data.collabVolume} />
            ) : growthTab === "revenue" ? (
              <BarChart
                bars={data.growth.map((m) => ({
                  label: m.label,
                  value: m.collaborations + m.influencers + m.businesses,
                }))}
              />
            ) : (
              <GrowthChart points={data.growth} />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E4EBFF] bg-white p-5 shadow-[0_8px_24px_rgba(17,26,90,0.04)] xl:col-span-3">
          <h2 className="font-display text-lg font-bold text-indigo">Collaboration Volume</h2>
          <div className="mt-3 flex items-end gap-2">
            <p className="font-display text-3xl font-bold text-indigo">
              {new Intl.NumberFormat("en-US").format(data.collabTotal)}
            </p>
            <p className={`pb-1 text-sm font-semibold ${collabTrend.className}`}>{collabTrend.text}</p>
          </div>
          <p className="mt-1 text-[12px] text-muted">Accepted collaborations on the platform</p>
          <div className="mt-4">
            <BarChart bars={data.collabVolume} />
          </div>
        </div>

        <div className="rounded-2xl border border-[#E4EBFF] bg-white p-5 shadow-[0_8px_24px_rgba(17,26,90,0.04)] xl:col-span-3">
          <h2 className="font-display text-lg font-bold text-indigo">System Health & Integrations</h2>
          <ul className="mt-4 space-y-3">
            {data.health.map((line) => (
              <li key={line.key} className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <HealthIcon healthKey={line.key} />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-indigo">{line.title}</p>
                    <p className="truncate text-[11px] text-muted">{line.detail}</p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    line.operational
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {line.operational ? "Operational" : "Attention"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-12">
        <div className="rounded-2xl border border-[#E4EBFF] bg-white p-5 shadow-[0_8px_24px_rgba(17,26,90,0.04)] xl:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-indigo">Recent Activity</h2>
            <Link href="/admin/jobs" className="text-[12px] font-semibold text-violet hover:underline">
              View all
            </Link>
          </div>
          <ul className="mt-4 space-y-4">
            {data.activity.length === 0 ? (
              <li className="text-sm text-muted">No recent admin activity yet.</li>
            ) : (
              data.activity.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      item.kind === "payment"
                        ? "bg-emerald-50 text-emerald-600"
                        : item.kind === "kyc"
                          ? "bg-amber-50 text-amber-600"
                          : item.kind === "contract"
                            ? "bg-[#E8F1FF] text-blue"
                            : "bg-[#EEE8FF] text-violet"
                    }`}
                  >
                    {item.kind === "payment" ? (
                      <IconWallet size={14} />
                    ) : item.kind === "kyc" ? (
                      <IconIdCard size={14} />
                    ) : item.kind === "contract" ? (
                      <IconFileText size={14} />
                    ) : (
                      <IconUser size={14} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-indigo">{item.title}</p>
                    <p className="truncate text-[12px] text-muted">{item.detail}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted">{relativeTime(item.at)}</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-[#E4EBFF] bg-white p-5 shadow-[0_8px_24px_rgba(17,26,90,0.04)] xl:col-span-4">
          <h2 className="font-display text-lg font-bold text-indigo">Quick Actions</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {QUICK.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-center justify-between gap-2 rounded-xl border border-[#E4EBFF] bg-[#FBFBFF] px-3 py-3 text-[13px] font-semibold text-indigo transition hover:border-violet/40 hover:bg-[#F5F1FF]"
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEE8FF] text-violet">
                      <Icon size={14} />
                    </span>
                    {item.label}
                  </span>
                  <IconArrowRight size={14} className="text-muted group-hover:text-violet" />
                </Link>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E4EBFF] bg-white p-5 shadow-[0_8px_24px_rgba(17,26,90,0.04)] xl:col-span-4">
          <h2 className="font-display text-lg font-bold text-indigo">Marketplace Insights</h2>
          <p className="mt-1 text-[12px] text-muted">Top Creator Categories</p>
          <div className="mt-3">
            {data.categories.length ? (
              <Donut
                slices={data.categories}
                centerValue={new Intl.NumberFormat("en-US").format(data.collabTotal)}
              />
            ) : (
              <p className="text-sm text-muted">No specialty data yet.</p>
            )}
          </div>
          <div className="mt-5">
            <p className="text-[12px] font-semibold text-indigo">Country Corridor Activity</p>
            <ul className="mt-2 space-y-2">
              {data.corridors.length === 0 ? (
                <li className="text-[12px] text-muted">No corridor volume in the last 30 days.</li>
              ) : (
                data.corridors.map((row) => {
                  const t = formatTrend(row.trend);
                  return (
                    <li
                      key={row.code}
                      className="flex items-center justify-between gap-2 rounded-lg bg-[#F7F9FF] px-3 py-2 text-[12px]"
                    >
                      <span className="font-semibold text-indigo">{row.code}</span>
                      <span className="text-muted">{row.count.toLocaleString()}</span>
                      <span className={`font-semibold ${t.className}`}>{t.text}</span>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-[#E4EBFF] bg-[#FBFBFF] p-3">
              <p className="text-[11px] font-semibold text-muted">Upcoming Payouts</p>
              <p className="mt-1 font-display text-lg font-bold text-indigo">
                {money(data.upcomingPayoutsCents)}
              </p>
              <p className="text-[11px] text-muted">{data.upcomingPayoutCount} payouts</p>
            </div>
            <div className="rounded-xl border border-[#E4EBFF] bg-[#FBFBFF] p-3">
              <p className="text-[11px] font-semibold text-muted">Pending Invitations</p>
              <p className="mt-1 font-display text-lg font-bold text-indigo">
                {data.pendingInvitations}
              </p>
              <p className={`text-[11px] font-semibold ${formatTrend(data.invitationTrend).className}`}>
                {formatTrend(data.invitationTrend).text}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function IconCalendarMini() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
