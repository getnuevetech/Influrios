"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAccountDialogBehavior } from "@/components/account-dialog";
import { FormalAgreementDocument, type FormalAgreementProps } from "@/components/formal-agreement-document";
import { nextTabIndex } from "@/lib/dialog-behavior";

export type ContractDialogParty = {
  id: string;
  name: string;
  role: string;
  signed: boolean;
  capacity?: string;
  entityName?: string;
  signedAtLabel?: string;
};

export type ContractDialogAmount = {
  label: string;
  amount: string;
  emphasis: boolean;
  negative?: boolean;
};

export type ContractDialogActivity = {
  id: string;
  atLabel: string;
  label: string;
  detail?: string;
};

export function ContractAgreementDialog({
  title,
  subtitle,
  signatureProgress,
  fundingLabel,
  amounts,
  formal,
  bodyFallback,
  activities,
  parties,
  showDeliverables,
  deliverablesHref,
  downloadHref,
  downloadLabel,
  closeHref,
  signHref,
  signingAs,
  primary,
  initialTab = "overview",
}: {
  title: string;
  subtitle: string;
  signatureProgress: string;
  fundingLabel: string | null;
  amounts: ContractDialogAmount[];
  formal: FormalAgreementProps | null;
  bodyFallback: string;
  activities: ContractDialogActivity[];
  parties: ContractDialogParty[];
  showDeliverables: boolean;
  deliverablesHref: string | null;
  downloadHref: string;
  downloadLabel: string;
  closeHref: string;
  signHref: string | null;
  signingAs: string | null;
  primary: { label: string; href: string } | null;
  initialTab?: "overview" | "document" | "signers" | "activity";
}) {
  const [tab, setTab] = useState(initialTab);
  const tabs = [
    ["overview", "Overview"],
    ["document", "Document"],
    ["signers", "Signers"],
    ["activity", "Activity"],
  ] as const;
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  useAccountDialogBehavior(panelRef, () => router.push(closeHref, { scroll: false }));

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  return (
    <div data-account-dialog-root className="fixed inset-0 z-50">
      <Link href={closeHref} scroll={false} aria-label="Close agreement" className="absolute inset-0 bg-[#1B1464]/35" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agreement-dialog-title"
        className="absolute inset-0 flex flex-col bg-white sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(92vh,900px)] sm:w-[min(920px,calc(100%-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:shadow-[0_24px_80px_rgba(27,20,100,0.28)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#EEF2F7] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="agreement-dialog-title" className="font-display text-xl font-bold text-[#1B1464] sm:text-2xl">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[#667085]">{subtitle}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-[#E8F8EE] px-2.5 py-1 text-[#178A45]">Signatures: {signatureProgress}</span>
              {fundingLabel ? (
                <span className="rounded-full bg-[#EEF3FF] px-2.5 py-1 text-[#2F6BFF]">Funding: {fundingLabel}</span>
              ) : null}
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
            <section className="rounded-2xl border border-[#E7ECF5] p-4">
              <h3 className="text-sm font-bold text-[#1B1464]">Financial summary</h3>
              <p className="mt-1 text-xs text-[#98A2B3]">One breakdown for this viewer. Signature status and funding status stay separate.</p>
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
                      <dd className={line.negative ? "text-[#D14343]" : undefined}>
                        {line.negative && !line.amount.trim().startsWith("−") && !line.amount.trim().startsWith("-")
                          ? `− ${line.amount}`
                          : line.amount}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          ) : null}

          {tab === "document" ? (
            <div className="space-y-3">
              {formal ? (
                <div className="overflow-hidden rounded-2xl border border-[#E7ECF5] bg-[#F8FAFC] p-3 sm:p-4">
                  <FormalAgreementDocument {...formal} footerNote="Agreement preview" />
                </div>
              ) : (
                <div className="rounded-2xl border border-[#E7ECF5] bg-[#FBFCFE] p-4">
                  <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-[#1B1464]">
                    {bodyFallback || "The agreement text is not available yet."}
                  </pre>
                </div>
              )}
            </div>
          ) : null}

          {tab === "signers" ? (
            <section className="space-y-3">
              <p className="text-xs text-[#98A2B3]">Each contracting party, its authorized signer, capacity, and recorded signing time.</p>
              <ul className="space-y-2">
                {parties.map((party) => (
                  <li
                    key={party.id}
                    className={`rounded-2xl border px-4 py-3 text-sm ${
                      party.signed ? "border-[#C6EBD5] bg-[#E8F8EE] text-[#178A45]" : "border-[#F3D7A1] bg-[#FFF8EC] text-[#8A5A12]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-[#1B1464]">{party.entityName || party.name}</p>
                        <p className="mt-1 text-xs text-[#667085]">
                          Signer: {party.name}
                          {party.capacity ? ` · ${party.capacity}` : ""}
                        </p>
                        {party.signedAtLabel ? <p className="mt-1 text-xs text-[#667085]">Signed {party.signedAtLabel}</p> : null}
                      </div>
                      <span className="font-semibold">{party.signed ? "Signed" : "Awaiting signature"}</span>
                    </div>
                  </li>
                ))}
              </ul>
              {signHref ? (
                <div className="rounded-2xl border border-[#E7ECF5] bg-[#FBFCFE] p-4">
                  {signingAs ? <p className="mb-3 text-sm font-semibold text-[#1B1464]">{signingAs}</p> : null}
                  <Link href={signHref} className="inline-flex rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">
                    Review and sign
                  </Link>
                </div>
              ) : null}
            </section>
          ) : null}

          {tab === "activity" ? (
            <section>
              {activities.length === 0 ? (
                <p className="text-sm text-[#667085]">No activity recorded yet.</p>
              ) : (
                <ul className="space-y-4">
                  {activities.map((event) => (
                    <li key={event.id} className="flex gap-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#6D4AFF]" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[#1B1464]">{event.label}</p>
                        {event.detail ? <p className="text-sm text-[#667085]">{event.detail}</p> : null}
                      </div>
                      <span className="text-xs text-[#98A2B3]">{event.atLabel}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#EEF2F7] px-5 py-4 sm:px-6">
          <Link href={closeHref} scroll={false} className="rounded-full border border-[#E7ECF5] px-4 py-2 text-sm font-semibold text-[#344054]">
            Close
          </Link>
          <a
            href={downloadHref}
            download
            className="inline-flex items-center gap-2 rounded-full border border-[#6D4AFF] px-4 py-2 text-sm font-semibold text-[#6D4AFF]"
          >
            {downloadLabel}
          </a>
          {primary ? (
            <Link href={primary.href} className="inline-flex rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">
              {primary.label}
            </Link>
          ) : showDeliverables && deliverablesHref ? (
            <Link href={deliverablesHref} className="inline-flex rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">
              Open deliverables
            </Link>
          ) : null}
        </div>
      </div>
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
