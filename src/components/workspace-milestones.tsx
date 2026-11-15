/** @jsxRuntime automatic */
/** @jsxImportSource react */
import type { ReactNode } from "react";

const TONE = {
  attention: "bg-amber-100 text-amber-900",
  open: "bg-[#EDE7FF] text-[#6D4AFF]",
  review: "bg-[#E7F0FF] text-[#1D4ED8]",
  done: "bg-emerald-50 text-emerald-800",
  hold: "bg-amber-50 text-amber-900",
} as const;

export type WorkspaceRowModel = {
  id: string;
  name: string;
  amount: string;
  workStatus: string;
  workTone: keyof typeof TONE;
  paymentStatus: string;
  bankLine: string | null;
  actionLabel: string;
  actionHref: string;
  nextActor: string | null;
  note: string | null;
};

export function WorkspaceMilestoneTable({
  amountHeading,
  rows,
  dimmed,
}: {
  amountHeading: string;
  rows: WorkspaceRowModel[];
  dimmed?: boolean;
}) {
  return (
    <div className={dimmed ? "opacity-40" : undefined}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[#E6ECF7] text-xs font-semibold text-[#667085]">
              <th className="px-3 py-3 font-semibold">Milestone</th>
              <th className="px-3 py-3 font-semibold">{amountHeading}</th>
              <th className="px-3 py-3 font-semibold">Work status</th>
              <th className="px-3 py-3 font-semibold">Payment</th>
              <th className="px-3 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} id={`milestone-${row.id}`} className="border-b border-[#EEF2F8] align-top">
                <td className="px-3 py-3 font-semibold text-[#1B1464]">{row.name}</td>
                <td className="px-3 py-3 text-[#1B1464]">{row.amount}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[row.workTone]}`}>
                    {row.workStatus}
                  </span>
                </td>
                <td className="px-3 py-3 text-[#344054]">
                  <p>{row.paymentStatus}</p>
                  {row.bankLine ? <p className="mt-1 text-xs font-semibold text-emerald-800">{row.bankLine}</p> : null}
                </td>
                <td className="px-3 py-3">
                  {row.nextActor ? <p className="mb-1 text-xs text-[#667085]">{row.nextActor}</p> : null}
                  <a href={row.actionHref} data-keep-scroll className="font-semibold text-[#6D4AFF] hover:underline">
                    {row.actionLabel}
                  </a>
                  {row.note ? <p className="mt-1 text-xs text-amber-800">{row.note}</p> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type FormAction = (formData: FormData) => void | Promise<void>;

export function WorkspaceDialogBody({
  title,
  subtitle,
  closeHref,
  feedback,
  history,
  paymentHistory,
  holdReason,
  bankLine,
  mode,
  showSubmitForm,
  submitLabel,
  reviewVersion,
  canRequestChanges,
  approveHref,
  dealId,
  milestoneId,
  tab,
  submitAction,
  reviseAction,
  filesAction,
  showBusinessFiles,
}: {
  title: string;
  subtitle: string;
  closeHref: string;
  feedback: { version: number; note: string } | null;
  history: string[];
  paymentHistory: string[];
  holdReason: string | null;
  bankLine: string | null;
  mode: "submit" | "review" | "details";
  showSubmitForm: boolean;
  submitLabel: string | null;
  reviewVersion: number | null;
  canRequestChanges: boolean;
  approveHref: string | null;
  dealId: string;
  milestoneId: string;
  tab: string;
  submitAction?: FormAction;
  reviseAction?: FormAction;
  filesAction?: FormAction;
  showBusinessFiles?: boolean;
}) {
  return (
    <section>
      <h2 id="workspace-focus-title" className="font-display text-xl font-bold text-[#1B1464]">
        {title}
      </h2>
      <p className="mt-1 text-sm text-[#667085]">{subtitle}</p>
      {feedback ? (
        <div className="mt-4">
          <p className="text-sm font-semibold text-[#1B1464]">Feedback on version {feedback.version}</p>
          <p className="mt-2 rounded-xl bg-[#F4F6FB] px-3 py-3 text-sm text-[#344054]">{feedback.note}</p>
        </div>
      ) : null}
      {holdReason ? <p className="mt-4 text-sm text-amber-900">{holdReason}</p> : null}
      {mode !== "submit" && history.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm font-semibold text-[#1B1464]">Version history</p>
          <ul className="mt-2 space-y-2 text-sm text-[#344054]">
            {history.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {mode !== "submit" && paymentHistory.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm font-semibold text-[#1B1464]">Payment history</p>
          <ul className="mt-2 space-y-2 text-sm text-[#344054]">
            {paymentHistory.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {bankLine ? <p className="mt-3 text-sm font-semibold text-emerald-800">{bankLine}</p> : null}
      {mode === "submit" && showSubmitForm && submitAction && submitLabel ? (
        <form action={submitAction} data-keep-scroll className="mt-4 space-y-3">
          <input type="hidden" name="dealId" value={dealId} />
          <input type="hidden" name="milestoneId" value={milestoneId} />
          <input type="hidden" name="tab" value={tab} />
          <label className="block text-sm font-semibold text-[#1B1464]">
            Deliverable link
            <input
              name="linkUrl"
              placeholder="https://"
              className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-2 text-sm font-normal"
            />
          </label>
          <label className="block text-sm font-semibold text-[#1B1464]">
            What changed?
            <textarea
              name="note"
              rows={3}
              placeholder="Describe the updates in this version..."
              className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-2 text-sm font-normal"
            />
          </label>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E4E9F5] px-3 py-2 text-sm font-semibold text-[#1B1464]">
            Attach files
            <input
              name="files"
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov,.mp3,.wav,.m4a,.zip"
              className="sr-only"
            />
          </label>
          <p className="text-xs text-[#667085]">Submitting starts the review window.</p>
          <div className="flex justify-end gap-2">
            <a href={closeHref} data-keep-scroll className="inline-flex h-11 items-center rounded-full border border-[#E4E9F5] px-4 text-sm font-semibold text-[#1B1464]">
              Cancel
            </a>
            <button type="submit" className="inline-flex h-11 items-center rounded-full bg-[#6D4AFF] px-4 text-sm font-semibold text-white">
              {submitLabel}
            </button>
          </div>
        </form>
      ) : null}
      {mode === "review" && reviewVersion != null && canRequestChanges && reviseAction ? (
        <form action={reviseAction} data-keep-scroll className="mt-4 space-y-3">
          <input type="hidden" name="dealId" value={dealId} />
          <input type="hidden" name="milestoneId" value={milestoneId} />
          <input type="hidden" name="versionNumber" value={reviewVersion} />
          <input type="hidden" name="tab" value={tab} />
          <label className="block text-sm font-semibold text-[#1B1464]">
            What should change
            <textarea name="note" required minLength={8} rows={3} className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-2 text-sm font-normal" />
          </label>
          <button type="submit" className="inline-flex h-11 items-center rounded-full border border-[#E4E9F5] px-4 text-sm font-semibold text-[#1B1464]">
            Request changes
          </button>
        </form>
      ) : null}
      {mode === "review" && approveHref ? (
        <p className="mt-4">
          <a href={approveHref} data-keep-scroll className="inline-flex h-11 items-center rounded-full bg-[#6D4AFF] px-4 text-sm font-semibold text-white">
            Approve version {reviewVersion}
          </a>
        </p>
      ) : null}
      {mode === "review" ? (
        <p className="mt-3 text-xs text-[#667085]">Approval identifies this version. It does not confirm a bank payout.</p>
      ) : null}
      {showBusinessFiles && filesAction ? (
        <form action={filesAction} data-keep-scroll className="mt-4 space-y-2">
          <input type="hidden" name="dealId" value={dealId} />
          <input type="hidden" name="milestoneId" value={milestoneId} />
          <input type="hidden" name="tab" value={tab} />
          <label className="block text-xs font-semibold text-[#667085]">
            Add files
            <input name="files" type="file" multiple className="mt-1 block w-full text-sm font-normal" />
          </label>
          <button type="submit" className="rounded-full border border-[#E4E9F5] px-4 py-2 text-sm font-semibold text-[#1B1464]">
            Add files
          </button>
        </form>
      ) : null}
      {mode !== "submit" ? (
        <p className="mt-4">
          <a href={closeHref} data-keep-scroll className="text-sm font-semibold text-[#6D4AFF]">
            Cancel
          </a>
        </p>
      ) : null}
    </section>
  );
}

export function WorkspaceTabs({
  tabs,
  active,
  agreementHref,
  paymentsHref,
}: {
  tabs: { id: string; label: string; href: string }[];
  active: string;
  agreementHref: string | null;
  paymentsHref: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#E6ECF7]">
      <div role="tablist" aria-label="Workspace" className="flex flex-wrap gap-4">
        {tabs.map((tab) => {
          const on = tab.id === active;
          return (
            <a
              key={tab.id}
              href={tab.href}
              role="tab"
              aria-selected={on}
              data-keep-scroll
              className={`border-b-2 pb-3 text-sm font-semibold ${on ? "border-[#6D4AFF] text-[#6D4AFF]" : "border-transparent text-[#667085]"}`}
            >
              {tab.label}
            </a>
          );
        })}
      </div>
      <div className="flex gap-4 pb-3 text-sm font-semibold">
        {agreementHref ? (
          <a href={agreementHref} className="text-[#6D4AFF] hover:underline">
            View agreement
          </a>
        ) : null}
        <a href={paymentsHref} className="text-[#6D4AFF] hover:underline">
          View payments
        </a>
      </div>
    </div>
  );
}

export function WorkspaceFrame({ children }: { children: ReactNode }) {
  return <div data-screen="W01" className="min-w-0">{children}</div>;
}
