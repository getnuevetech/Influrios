import Link from "next/link";
import type { ReactNode } from "react";

export function ProfileSummaryCard({
  title,
  status,
  children,
  href,
  actionLabel = "Manage",
}: {
  title: string;
  status?: ReactNode;
  children: ReactNode;
  href: string;
  actionLabel?: string;
}) {
  return (
    <article className="flex flex-col rounded-2xl border border-[#E4EBFF] bg-white p-5 shadow-[0_8px_24px_rgba(17,26,90,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-indigo">{title}</h2>
          {status ? <div className="mt-1 text-[12px] font-semibold text-muted">{status}</div> : null}
        </div>
        <Link
          href={href}
          className="shrink-0 rounded-full border border-[#E4EBFF] bg-[#F7F9FF] px-3 py-1.5 text-[12px] font-semibold text-violet hover:border-violet/40"
        >
          {actionLabel}
        </Link>
      </div>
      <div className="mt-4 flex-1 text-sm text-indigo">{children}</div>
    </article>
  );
}

export function Chip({ children, tone = "violet" }: { children: ReactNode; tone?: "violet" | "blue" | "emerald" | "muted" }) {
  const cls =
    tone === "blue"
      ? "bg-[#E8F1FF] text-blue"
      : tone === "emerald"
        ? "bg-emerald-50 text-emerald-700"
        : tone === "muted"
          ? "bg-[#F3F6FF] text-muted"
          : "bg-[#EEE8FF] text-violet";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>{children}</span>
  );
}
