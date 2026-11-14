"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { useAccountDialogBehavior } from "@/components/account-dialog";
import { nextTabIndex } from "@/lib/dialog-behavior";

export function PaymentDetailsDialog({
  closeHref,
  title,
  company,
  status,
  statusClass,
  workspaceHref,
  overview,
  fees,
  timeline,
  milestones,
  cancellation,
  documents,
  initialTab = "overview",
}: {
  closeHref: string;
  title: string;
  company: string;
  status: string;
  statusClass: string;
  workspaceHref: string;
  overview: ReactNode;
  fees: ReactNode;
  timeline: ReactNode;
  milestones: ReactNode;
  cancellation: ReactNode;
  documents: ReactNode;
  initialTab?: "overview" | "cancellation";
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"overview" | "fees" | "timeline" | "milestones" | "cancellation" | "documents">(initialTab);
  useAccountDialogBehavior(panelRef, () => router.push(closeHref, { scroll: false }));

  const tabs = [
    ["overview", "Overview"],
    ["fees", "Fee breakdown"],
    ["timeline", "Payment timeline"],
    ["milestones", "Milestones"],
    ["cancellation", "Cancellation and refunds"],
    ["documents", "Documents"],
  ] as const;

  return (
    <div data-account-dialog-root className="fixed inset-0 z-50">
      <Link href={closeHref} scroll={false} aria-label="Close payment details" className="absolute inset-0 bg-[#1B1464]/40" />
      <div
        ref={panelRef}
        tabIndex={-1}
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
        <div
          role="tablist"
          aria-label="Payment sections"
          className="mt-4 flex flex-wrap gap-2 px-5 sm:px-7"
          onKeyDown={(event) => {
            const index = tabs.findIndex(([id]) => id === tab);
            const next = nextTabIndex(tabs.length, index, event.key);
            if (next == null) return;
            event.preventDefault();
            const item = tabs[next];
            if (item) setTab(item[0]);
          }}
        >
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
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
          <div hidden={tab !== "fees"}>{fees}</div>
          <div hidden={tab !== "timeline"}>{timeline}</div>
          <div hidden={tab !== "milestones"}>{milestones}</div>
          <div hidden={tab !== "cancellation"}>{cancellation}</div>
          <div hidden={tab !== "documents"}>{documents}</div>
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
