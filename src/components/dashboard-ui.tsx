import Link from "next/link";
import type { ReactNode } from "react";

export function MiniSpark({
  points,
  stroke = "#6366F1",
}: {
  points: number[];
  stroke?: string;
}) {
  const series = points.length >= 2 ? points : [0, 0, 0, 0, 0, 0, 1];
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const span = Math.max(max - min, 1);
  const coords = series
    .map((value, index) => {
      const x = (index / (series.length - 1)) * 100;
      const y = 28 - ((value - min) / span) * 22;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 32" className="h-8 w-full" aria-hidden>
      <polyline fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={coords} />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  note,
  tone = "violet",
  icon,
  points,
  delta,
}: {
  label: string;
  value: string;
  note: string;
  tone?: "violet" | "blue" | "emerald" | "amber";
  icon?: ReactNode;
  points?: number[];
  delta?: { label: string; positive?: boolean | null };
}) {
  const tones = {
    violet: { chip: "bg-[#F1ECFF] text-violet", stroke: "#7C3AED" },
    blue: { chip: "bg-[#E8F0FF] text-[#2F5FD0]", stroke: "#3B82F6" },
    emerald: { chip: "bg-emerald-50 text-emerald-700", stroke: "#10B981" },
    amber: { chip: "bg-amber-50 text-amber-700", stroke: "#F59E0B" },
  }[tone];
  const deltaClass =
    delta?.positive === true
      ? "text-emerald-600"
      : delta?.positive === false
        ? "text-rose-600"
        : "text-muted";
  return (
    <div className="rounded-2xl border border-[#E6ECF7] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <p className="font-display text-2xl font-bold text-indigo">{value}</p>
            {delta ? <span className={`text-xs font-semibold ${deltaClass}`}>{delta.label}</span> : null}
          </div>
          <p className="mt-1 text-xs text-muted">{note}</p>
        </div>
        {icon ? <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${tones.chip}`}>{icon}</span> : null}
      </div>
      {points ? (
        <div className="mt-3">
          <MiniSpark points={points} stroke={tones.stroke} />
        </div>
      ) : null}
    </div>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "info" | "warn" | "violet";
}) {
  const className = {
    neutral: "bg-[#EEF2FA] text-[#4E5872]",
    success: "bg-emerald-50 text-emerald-700",
    info: "bg-[#E8F0FF] text-[#2F5FD0]",
    warn: "bg-amber-50 text-amber-800",
    violet: "bg-[#F1ECFF] text-violet",
  }[tone];
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${className}`}>{children}</span>;
}

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-[#E6ECF7] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-indigo">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="text-xs font-semibold text-violet hover:underline">
      {children}
    </Link>
  );
}

export function ChecklistItem({
  done,
  label,
  href,
}: {
  done: boolean;
  label: string;
  href?: string;
}) {
  const body = (
    <span className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2">
        <span
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
            done ? "bg-emerald-500 text-white" : "border border-[#D7DEEE] text-transparent"
          }`}
        >
          ✓
        </span>
        <span className={done ? "text-indigo" : "text-muted"}>{label}</span>
      </span>
      <span className="text-muted">›</span>
    </span>
  );
  if (!href) return <li className="text-sm">{body}</li>;
  return (
    <li className="text-sm">
      <Link href={href} className="block rounded-xl px-1 py-1.5 hover:bg-[#F7F8FC]">
        {body}
      </Link>
    </li>
  );
}
