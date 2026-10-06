import type { ReactNode } from "react";

/** Server-friendly collapsible block (native details/summary). */
export function AdminCollapse({
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="group rounded-2xl border border-[#E4EBFF] bg-white open:shadow-sm"
      open={defaultOpen || undefined}
    >
      <summary className="cursor-pointer list-none px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-indigo">{title}</p>
            {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
          </div>
          <span className="shrink-0 text-xs font-semibold text-violet group-open:hidden">Expand</span>
          <span className="hidden shrink-0 text-xs font-semibold text-violet group-open:inline">Collapse</span>
        </div>
      </summary>
      <div className="border-t border-[#E4EBFF] px-4 py-4">{children}</div>
    </details>
  );
}
