import Link from "next/link";
import type { ReactNode } from "react";

export function OverviewCard({
  title,
  href,
  actionLabel = "Edit",
  children,
  className = "",
  status,
}: {
  title: string;
  href?: string;
  actionLabel?: string;
  children: ReactNode;
  className?: string;
  status?: ReactNode;
}) {
  return (
    <article
      className={`rounded-2xl border border-[#E6ECF7] bg-white p-5 shadow-[0_4px_18px_rgba(17,26,90,0.03)] ${className}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-indigo">{title}</h2>
          {status ? <div className="mt-1">{status}</div> : null}
        </div>
        {href ? (
          <Link
            href={href}
            className="shrink-0 rounded-lg border border-[#E6ECF7] bg-white px-2.5 py-1 text-[12px] font-semibold text-violet hover:border-violet/30 hover:bg-[#F7F5FF]"
          >
            {actionLabel}
          </Link>
        ) : null}
      </div>
      <div className="text-sm text-indigo">{children}</div>
    </article>
  );
}

export function SoftPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-[#F1ECFF] px-2.5 py-1 text-[11px] font-semibold text-violet">
      {children}
    </span>
  );
}

export function MutedPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-[#F3F5FA] px-2.5 py-1 text-[11px] font-semibold text-muted">
      {children}
    </span>
  );
}
