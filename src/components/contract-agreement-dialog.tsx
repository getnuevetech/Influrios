"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { useAccountDialogBehavior } from "@/components/account-dialog";
import { nextTabIndex } from "@/lib/dialog-behavior";

export type ContractDialogParty = {
  id: string;
  name: string;
  role: string;
  signed: boolean;
};

export type ContractDialogAmount = {
  label: string;
  amount: string;
  emphasis: boolean;
};

export function ContractAgreementDialog({
  title,
  status,
  statusClass,
  company,
  influencer,
  updated,
  parties,
  amounts,
  body,
  deliverables,
  showDeliverables,
  deliverablesHref,
  downloadHref,
  downloadLabel,
  closeHref,
  signHref,
  primary,
}: {
  title: string;
  status: string;
  statusClass: string;
  company: string;
  influencer: string;
  updated: string;
  parties: ContractDialogParty[];
  amounts: ContractDialogAmount[];
  body: string;
  deliverables: string[];
  showDeliverables: boolean;
  deliverablesHref: string | null;
  downloadHref: string;
  downloadLabel: string;
  closeHref: string;
  signHref: string | null;
  primary: { label: string; href: string } | null;
}) {
  const [tab, setTab] = useState<"overview" | "fees" | "signatures" | "documents">("overview");
  const tabs = [
    ["overview", "Overview"],
    ["fees", "Terms and fees"],
    ["signatures", "Signatures"],
    ["documents", "Documents"],
  ] as const;
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  useAccountDialogBehavior(panelRef, () => router.push(closeHref, { scroll: false }));

  return (
    <div data-account-dialog-root className="fixed inset-0 z-50">
      <Link href={closeHref} scroll={false} aria-label="Close agreement" className="absolute inset-0 bg-[#1B1464]/35" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agreement-dialog-title"
        className="absolute inset-0 flex flex-col bg-white sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(90vh,840px)] sm:w-[min(920px,calc(100%-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:shadow-[0_24px_80px_rgba(27,20,100,0.28)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#EEF2F7] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">Agreement details</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 id="agreement-dialog-title" className="font-display text-xl font-bold text-[#1B1464] sm:text-2xl">
                {title}
              </h2>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass}`}>{status}</span>
            </div>
          </div>
          <Link
            href={closeHref}
            scroll={false}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#667085] hover:bg-[#F4F6FB]"
          >
            ×
          </Link>
        </div>
        <div
          role="tablist"
          aria-label="Agreement sections"
          className="flex gap-5 border-b border-[#EEF2F7] px-5 text-sm font-semibold sm:px-6"
          onKeyDown={(event) => {
            const index = tabs.findIndex(([id]) => id === tab);
            const next = nextTabIndex(tabs.length, index, event.key);
            if (next == null) return;
            event.preventDefault();
            const item = tabs[next];
            if (!item) return;
            setTab(item[0]);
          }}
        >
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`agreement-tab-${id}`}
              aria-selected={tab === id}
              aria-controls={`agreement-panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              className={`border-b-2 py-3 ${tab === id ? "border-[#6D4AFF] text-[#6D4AFF]" : "border-transparent text-[#667085]"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div id={`agreement-panel-${tab}`} role="tabpanel" aria-labelledby={`agreement-tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {tab === "overview" ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <section className="rounded-2xl border border-[#E7ECF5] p-4">
                  <h3 className="text-sm font-bold text-[#1B1464]">Agreement summary</h3>
                  <dl className="mt-3 space-y-3 text-sm">
                    <SummaryRow label="Company" value={company} />
                    <SummaryRow label="Influencer" value={influencer} />
                    <SummaryRow label="Updated" value={updated} />
                  </dl>
                </section>
                <section className="rounded-2xl border border-[#E7ECF5] p-4">
                  <h3 className="text-sm font-bold text-[#1B1464]">Signature progress</h3>
                  <p className="mt-1 text-xs text-[#98A2B3]">Fully signed describes signatures only.</p>
                  <ul className="mt-3 space-y-2">
                    {parties.map((party) => (
                      <li
                        key={party.id}
                        className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                          party.signed ? "bg-[#E8F8EE] text-[#178A45]" : "bg-[#FFF6E8] text-[#B86E00]"
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/70 text-[11px]">
                            {(party.name || party.role).slice(0, 1).toUpperCase()}
                          </span>
                          {party.name || party.role}
                        </span>
                        <span>{party.signed ? "✓ Signed" : "Pending"}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
              <section className="rounded-2xl border border-[#E7ECF5] p-4">
                <h3 className="text-sm font-bold text-[#1B1464]">Agreed amounts</h3>
                {amounts.length === 0 ? (
                  <p className="mt-3 text-sm text-[#667085]">Amounts appear here after the agreement records a fee breakdown.</p>
                ) : (
                  <dl className="mt-2">
                    {amounts.map((line) => (
                      <div
                        key={line.label}
                        className={`flex items-center justify-between gap-3 py-2.5 text-sm ${
                          line.emphasis ? "rounded-xl bg-[#F7F4FF] px-3 font-bold text-[#1B1464]" : "text-[#344054]"
                        }`}
                      >
                        <dt>{line.label}</dt>
                        <dd>{line.amount}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>
            </div>
          ) : null}
          {tab === "fees" ? (
            <section className="rounded-2xl border border-[#E7ECF5] p-4">
              <h3 className="text-sm font-bold text-[#1B1464]">Signed amounts</h3>
              <p className="mt-1 text-xs text-[#98A2B3]">These figures come from the signed snapshot. A later fee rule does not change them.</p>
              {amounts.length === 0 ? (
                <p className="mt-3 text-sm text-[#667085]">Amounts appear here after the agreement records a fee breakdown.</p>
              ) : (
                <dl className="mt-2">
                  {amounts.map((line) => (
                    <div key={line.label} className={`flex items-center justify-between gap-3 py-2.5 text-sm ${line.emphasis ? "rounded-xl bg-[#F7F4FF] px-3 font-bold text-[#1B1464]" : "text-[#344054]"}`}>
                      <dt>{line.label}</dt>
                      <dd>{line.amount}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {showDeliverables ? (
                <div className="mt-4">
                  <h3 className="text-sm font-bold text-[#1B1464]">Deliverables</h3>
                  {deliverables.length === 0 ? (
                    <p className="mt-2 text-sm text-[#667085]">No deliverable lines are written on this agreement.</p>
                  ) : (
                    <ul className="mt-2 space-y-2 text-sm text-[#1B1464]">
                      {deliverables.map((line) => (
                        <li key={line} className="rounded-xl bg-[#F8FAFC] px-3 py-2">{line}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </section>
          ) : null}
          {tab === "signatures" ? (
            <section className="rounded-2xl border border-[#E7ECF5] p-4">
              <h3 className="text-sm font-bold text-[#1B1464]">Signature progress</h3>
              <p className="mt-1 text-xs text-[#98A2B3]">Fully signed describes signatures only. Funding is a separate status.</p>
              <ul className="mt-3 space-y-2">
                {parties.map((party) => (
                  <li key={party.id} className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${party.signed ? "bg-[#E8F8EE] text-[#178A45]" : "bg-[#FFF6E8] text-[#B86E00]"}`}>
                    <span>{party.name || party.role}</span>
                    <span>{party.signed ? "Signed" : "Awaiting signature"}</span>
                  </li>
                ))}
              </ul>
              {signHref ? (
                <Link href={signHref} className="mt-4 inline-flex rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">
                  Review and sign
                </Link>
              ) : null}
            </section>
          ) : null}
          {tab === "documents" ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-[#E7ECF5] bg-[#FBFCFE] p-4">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#1B1464]">
                  {body || "The agreement text is not available yet."}
                </pre>
              </div>
              <a href={downloadHref} className="inline-flex rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">
                {downloadLabel}
              </a>
              {deliverablesHref ? (
                <Link href={deliverablesHref} className="ml-2 inline-flex rounded-full border border-[#E4E9F5] px-4 py-2 text-sm font-semibold text-[#6D4AFF]">
                  Open workspace
                </Link>
              ) : (
                <p className="text-xs text-[#98A2B3]">Deliverable uploads open after this agreement is funded.</p>
              )}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#EEF2F7] px-5 py-4 sm:px-6">
          <Link
            href={closeHref}
            scroll={false}
            className="rounded-full border border-[#E7ECF5] px-4 py-2 text-sm font-semibold text-[#344054]"
          >
            Close
          </Link>
          <a href={downloadHref} className="inline-flex items-center gap-2 rounded-full border border-[#E7ECF5] px-4 py-2 text-sm font-semibold text-[#344054]">
            ↓ {downloadLabel}
          </a>
          {primary ? (
            <Link href={primary.href} className="inline-flex rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">
              {primary.label}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[#98A2B3]">{label}</dt>
      <dd className="text-right font-semibold text-[#1B1464]">{value || "—"}</dd>
    </div>
  );
}

export function ContractRowMenu({
  items,
  children,
}: {
  items: Array<{ href: string; label: string }>;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0 && !children) return null;
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="More actions"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#667085] hover:bg-[#F4F6FB]"
      >
        ···
      </button>
      {open ? (
        <span className="absolute right-0 top-9 z-20 min-w-44 rounded-2xl border border-[#E7ECF5] bg-white p-1 text-left shadow-lg">
          {children}
          {items.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              className="block rounded-xl px-3 py-2 text-xs font-semibold text-[#344054] hover:bg-[#F7F4FF]"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </span>
      ) : null}
    </span>
  );
}
