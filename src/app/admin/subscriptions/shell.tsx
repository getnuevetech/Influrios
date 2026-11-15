import Link from "next/link";
import type { ReactNode } from "react";

export function SubscriptionsShell({
  active,
  showPlans,
  showBilling,
  children,
}: {
  active: "plans" | "billing";
  showPlans: boolean;
  showBilling: boolean;
  children: ReactNode;
}) {
  const tabs = [
    showPlans ? { href: "/admin/plans", id: "plans" as const, label: "Plans & features" } : null,
    showBilling ? { href: "/admin/billing", id: "billing" as const, label: "Billing activity" } : null,
  ].filter((tab) => tab != null);

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-sm text-muted">
        <Link href="/admin" className="font-semibold text-indigo hover:underline">
          Admin
        </Link>
        <span> / </span>
        <span className="font-semibold text-indigo">Subscriptions</span>
      </p>
      {tabs.length > 0 ? (
        <div className="mt-4 inline-flex rounded-2xl bg-white p-1 shadow-sm" role="tablist" aria-label="Subscriptions">
          {tabs.map((tab) => {
            const selected = tab.id === active;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                role="tab"
                aria-selected={selected}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  selected ? "bg-[#EEE8FF] text-violet underline decoration-violet decoration-2 underline-offset-[10px]" : "text-slate-500 hover:text-indigo"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      ) : null}
      {children}
    </div>
  );
}
