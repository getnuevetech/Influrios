"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { actionPublishEmailTemplate, actionRollbackEmailTemplate, actionSaveEmailTemplateDraft, actionSendEmailTemplateTest } from "@/app/admin/mail/templates/actions";
import { emailGroupLabel } from "@/lib/email-catalog";
import { renderCatalogPreview } from "@/lib/email-render";
import type { EmailCatalogTemplate } from "@/lib/email-catalog";

type HistoryRow = {
  id: string;
  kind: string;
  versionNumber: number;
  actor: string;
  updatedAtLabel: string;
  subject: string;
};

export function EmailTemplateDialog({
  template,
  copy,
  status,
  history,
  closeHref,
  canEdit,
  fromName,
  query,
}: {
  template: EmailCatalogTemplate;
  copy: { subject: string; preheader: string; headline: string; body: string[]; cta: string };
  status: string;
  history: HistoryRow[];
  closeHref: string;
  canEdit: boolean;
  fromName: string;
  query: { q: string; group: string };
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"copy" | "preview" | "variables" | "trigger" | "history">("copy");
  const [width, setWidth] = useState<"desktop" | "mobile">("desktop");
  const [subject, setSubject] = useState(copy.subject);
  const [preheader, setPreheader] = useState(copy.preheader);
  const [headline, setHeadline] = useState(copy.headline);
  const [body, setBody] = useState(copy.body.join("\n\n"));
  const [cta, setCta] = useState(copy.cta);
  const [recipient, setRecipient] = useState("");

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") router.push(closeHref, { scroll: false });
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [closeHref, router]);

  const preview = useMemo(() => {
    try {
      return renderCatalogPreview(template, {
        subject,
        preheader,
        title: headline,
        body: body.split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean),
        cta,
      });
    } catch (error) {
      return { error: error instanceof Error ? error.message : "This copy cannot be previewed." };
    }
  }, [body, cta, headline, preheader, subject, template]);

  const tabs = [
    ["copy", "Copy"],
    ["preview", "Design preview"],
    ["variables", "Variables"],
    ["trigger", "Trigger and schedule"],
    ["history", "Version history"],
  ] as const;

  return (
    <div className="fixed inset-0 z-50">
      <Link href={closeHref} scroll={false} aria-label="Close email template" className="absolute inset-0 bg-[#1B1464]/40" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-template-title"
        className="absolute inset-0 flex flex-col bg-white outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[min(92vh,880px)] sm:w-[min(860px,calc(100%-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px] sm:shadow-[0_24px_80px_rgba(27,20,100,0.28)]"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-7">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-[#5836D6]">{emailGroupLabel(template.group)}</p>
            <h2 id="email-template-title" className="mt-1 font-display text-2xl font-bold text-[#1B1464]">
              {template.title}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {template.audience} · {template.category} · {status}
            </p>
          </div>
          <Link href={closeHref} scroll={false} className="rounded-full px-3 py-1 text-sm font-semibold text-[#1B1464] hover:bg-[#F4F5FB]">
            Close
          </Link>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto px-5 sm:px-7" role="tablist">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold ${tab === id ? "bg-[#5836D6] text-white" : "bg-[#F4F5FB] text-[#1B1464]"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-7">
          {tab === "copy" ? (
            <form action={actionSaveEmailTemplateDraft} className="space-y-3">
              <input type="hidden" name="templateKey" value={template.id} />
              <input type="hidden" name="q" value={query.q} />
              <input type="hidden" name="group" value={query.group} />
              <label className="block text-sm font-semibold text-[#1B1464]">
                Subject
                <input name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} disabled={!canEdit} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
              </label>
              <label className="block text-sm font-semibold text-[#1B1464]">
                Preheader
                <input name="preheader" value={preheader} onChange={(event) => setPreheader(event.target.value)} disabled={!canEdit} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
              </label>
              <label className="block text-sm font-semibold text-[#1B1464]">
                Headline
                <input name="headline" value={headline} onChange={(event) => setHeadline(event.target.value)} disabled={!canEdit} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
              </label>
              <label className="block text-sm font-semibold text-[#1B1464]">
                Body
                <textarea name="body" value={body} onChange={(event) => setBody(event.target.value)} disabled={!canEdit} rows={8} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
              </label>
              <label className="block text-sm font-semibold text-[#1B1464]">
                Button label
                <input name="cta" value={cta} onChange={(event) => setCta(event.target.value)} disabled={!canEdit} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
              </label>
              <p className="text-xs text-muted">Saving a draft does not send this email and does not change the messages already going out.</p>
              {canEdit ? (
                <button type="submit" className="rounded-full bg-[#5836D6] px-4 py-2 text-sm font-bold text-white">
                  Save draft
                </button>
              ) : null}
            </form>
          ) : null}
          {tab === "preview" ? (
            <div>
              <div className="mb-3 flex gap-2">
                <button type="button" onClick={() => setWidth("desktop")} className={`rounded-full px-3 py-1 text-sm font-semibold ${width === "desktop" ? "bg-[#211E4E] text-white" : "bg-[#F4F5FB]"}`}>
                  Desktop
                </button>
                <button type="button" onClick={() => setWidth("mobile")} className={`rounded-full px-3 py-1 text-sm font-semibold ${width === "mobile" ? "bg-[#211E4E] text-white" : "bg-[#F4F5FB]"}`}>
                  Mobile
                </button>
              </div>
              {"error" in preview ? (
                <p className="text-sm font-semibold text-rose-700">{preview.error}</p>
              ) : (
                <iframe
                  title="Email design preview"
                  sandbox=""
                  srcDoc={preview.html}
                  className="mx-auto block h-[520px] rounded-2xl border border-[#E6E8F2] bg-[#F4F5FB]"
                  style={{ width: width === "mobile" ? 375 : "100%" }}
                />
              )}
            </div>
          ) : null}
          {tab === "variables" ? (
            <div className="space-y-4 text-sm">
              <ul className="space-y-1">
                {template.variables.map((name) => (
                  <li key={name} className="font-mono text-[#211E4E]">{`{{${name}}}`}</li>
                ))}
              </ul>
              {template.facts.length ? (
                <div>
                  <p className="font-semibold text-[#1B1464]">Summary rows</p>
                  <ul className="mt-2 space-y-1 text-muted">
                    {template.facts.map(([label, value]) => (
                      <li key={label}>
                        {label}: {value}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
          {tab === "trigger" ? (
            <div className="space-y-3 text-sm text-[#211E4E]">
              <p><span className="font-semibold">When it sends:</span> {template.trigger}</p>
              <p><span className="font-semibold">Guard:</span> {template.guard}</p>
              <p>This template starts off. Publish uses the saved draft and stores the version. Account, invitation, and collaboration mail still use their current senders until that category is switched.</p>
              {canEdit ? (
                <form action={actionPublishEmailTemplate}>
                  <input type="hidden" name="templateKey" value={template.id} />
                  <input type="hidden" name="q" value={query.q} />
                  <input type="hidden" name="group" value={query.group} />
                  <button type="submit" className="rounded-full bg-[#5836D6] px-4 py-2 text-sm font-bold text-white">
                    Publish version
                  </button>
                </form>
              ) : null}
              {canEdit ? (
                <form action={actionSendEmailTemplateTest} className="space-y-2">
                  <input type="hidden" name="templateKey" value={template.id} />
                  <input type="hidden" name="q" value={query.q} />
                  <input type="hidden" name="group" value={query.group} />
                  <input type="hidden" name="subject" value={subject} />
                  <input type="hidden" name="preheader" value={preheader} />
                  <input type="hidden" name="headline" value={headline} />
                  <input type="hidden" name="body" value={body} />
                  <input type="hidden" name="cta" value={cta} />
                  <label className="block text-sm font-semibold text-[#1B1464]">
                    Recipient
                    <input
                      name="to"
                      type="email"
                      required
                      value={recipient}
                      onChange={(event) => setRecipient(event.target.value)}
                      placeholder="name@example.com"
                      autoComplete="email"
                      className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
                    />
                  </label>
                  <p className="text-muted">
                    {fromName
                      ? `The test goes to this address only, from ${fromName}. It uses example links and does not move money.`
                      : "The test goes to this address only. No From name is saved, so the message shows the address alone. Set From name next to From address on Email settings. It uses example links and does not move money."}
                  </p>
                  <button type="submit" className="rounded-full border border-[#5836D6] px-4 py-2 text-sm font-bold text-[#5836D6]">
                    Send test
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
          {tab === "history" ? (
            <ul className="space-y-3">
              {history.length === 0 ? <li className="text-sm text-muted">No published version yet. The catalog copy is version 1.</li> : null}
              {history.map((row) => (
                <li key={row.id} className="rounded-2xl border border-[#E6E8F2] px-4 py-3 text-sm">
                  <p className="font-semibold text-[#1B1464]">
                    Version {row.versionNumber || "draft"} · {row.kind}
                  </p>
                  <p className="text-muted">{row.subject}</p>
                  <p className="text-xs text-muted">{row.updatedAtLabel}{row.actor ? ` · ${row.actor}` : ""}</p>
                  {canEdit && row.kind === "superseded" ? (
                    <form action={actionRollbackEmailTemplate} className="mt-2">
                      <input type="hidden" name="templateKey" value={template.id} />
                      <input type="hidden" name="recordId" value={row.id} />
                      <input type="hidden" name="q" value={query.q} />
                      <input type="hidden" name="group" value={query.group} />
                      <button type="submit" className="text-sm font-bold text-[#5836D6]">
                        Restore this version
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
