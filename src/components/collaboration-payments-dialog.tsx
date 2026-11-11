"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

export function PaymentDetailsDialog({
  closeHref,
  title,
  company,
  status,
  statusClass,
  workspaceHref,
  overview,
  milestones,
  transactions,
}: {
  closeHref: string;
  title: string;
  company: string;
  status: string;
  statusClass: string;
  workspaceHref: string;
  overview: ReactNode;
  milestones: ReactNode;
  transactions: ReactNode;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "milestones" | "transactions">("overview");

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") router.push(closeHref, { scroll: false });
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [closeHref, router]);

  const tabs = [
    ["overview", "Overview"],
    ["milestones", "Milestones"],
    ["transactions", "Transactions"],
  ] as const;

  return (
    <div className="fixed inset-0 z-50">
      <Link href={closeHref} scroll={false} aria-label="Close payment details" className="absolute inset-0 bg-[#1B1464]/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-dialog-title"
        className="absolute inset-0 flex flex-col bg-white sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(90vh,820px)] sm:w-[min(760px,calc(100%-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:shadow-[0_24px_80px_rgba(27,20,100,0.28)]"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-7">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#101828]">Payment details</p>
            <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id="payment-dialog-title" className="font-display text-2xl font-bold text-[#1B1464]">
                  {title}
                </h2>
                <p className="mt-1 text-sm text-[#667085]">{company}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>{status}</span>
            </div>
          </div>
          <Link
            href={closeHref}
            scroll={false}
            aria-label="Close"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#667085] hover:bg-[#F4F6FB]"
          >
            ×
          </Link>
        </div>
        <div className="mt-4 flex gap-2 px-5 sm:px-7">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                tab === id ? "bg-[#F4F0FF] text-[#6D4AFF]" : "text-[#667085] hover:bg-[#F7F8FC]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-7">
          <div hidden={tab !== "overview"}>{overview}</div>
          <div hidden={tab !== "milestones"}>{milestones}</div>
          <div hidden={tab !== "transactions"}>{transactions}</div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#EEF2F7] px-5 py-4 sm:px-7">
          <Link
            href={closeHref}
            scroll={false}
            className="rounded-full border border-[#E4E7EC] px-4 py-2 text-sm font-semibold text-[#344054]"
          >
            Close
          </Link>
          {tab === "milestones" ? (
            <Link href={workspaceHref} className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">
              Open collaboration
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
