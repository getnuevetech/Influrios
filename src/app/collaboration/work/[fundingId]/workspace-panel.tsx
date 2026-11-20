import { actionAddDeliverableFiles, actionRequestRevision, actionSubmitMilestone } from "@/app/payments/actions";
import { FocusDialog } from "@/app/collaboration/work/[fundingId]/focus-dialog";
import { WorkspaceMessages } from "@/app/collaboration/work/[fundingId]/messages-panel";
import { ReleaseStep } from "@/app/collaboration/work/[fundingId]/release-step";
import { WorkspaceScroll } from "@/app/collaboration/work/[fundingId]/workspace-scroll";
import { WorkspaceDialogBody, WorkspaceFrame, WorkspaceMilestoneTable, WorkspaceTabs } from "@/components/workspace-milestones";
import {
  fundingStatusLabel,
  workspaceCloseQuery,
  workspaceDecision,
  workspaceHref,
  workspaceTab,
  type WorkspaceActor,
  type WorkspaceMilestoneState,
} from "@/lib/workspace-decision";

type Notice = { tone: "ok" | "error"; text: string };

type PanelMilestone = {
  id: string;
  title: string;
  amountLabel: string;
  state: WorkspaceMilestoneState;
  disputeNote: string | null;
  grossCents: number;
  businessFeeCents: number;
  reviewFiles: { id: string; fileName: string; version: number }[];
};

export function WorkspacePanel({
  funding,
  business,
  actor,
  counterparty,
  collaborationsHref,
  contractHref,
  summary,
  amountHeading,
  milestones,
  files,
  briefScope,
  query,
  notices,
}: {
  funding: { id: string; status: string; title: string; currency: string };
  business: boolean;
  actor: WorkspaceActor;
  counterparty: string;
  collaborationsHref: string;
  contractHref: string | null;
  summary: { label: string; amount: string }[];
  amountHeading: "Net payout" | "Amount";
  milestones: PanelMilestone[];
  files: { id: string; fileName: string; milestoneTitle: string }[];
  briefScope: string | null;
  query: Record<string, string | undefined>;
  notices: Notice[];
}) {
  const tab = workspaceTab(query.tab);
  const closeQuery = workspaceCloseQuery({ ...query, tab });
  const closeHref = workspaceHref(funding.id, closeQuery);
  const tabHref = (id: string) => workspaceHref(funding.id, { ...closeQuery, tab: id });
  const decisions = milestones.map((milestone) => ({
    milestone,
    decision: workspaceDecision(milestone.state, actor),
  }));
  const focusedId = query.focus || query.release;
  const focused = decisions.find((row) => row.milestone.id === focusedId) ?? null;
  const releaseVersion = Number(query.version);
  const showRelease = Boolean(
    focused &&
      focused.decision.action.kind === "review" &&
      focused.decision.action.version === releaseVersion &&
      query.release === focused.milestone.id,
  );
  const mode = focusMode(focused?.decision.action.kind, query.intent, showRelease);
  const reviewStep = query.review === "changes" ? "changes" : "hub";
  const showSubmitForm = Boolean(focused && mode === "submit" && !business && funding.status === "held");
  const showBusinessFiles = Boolean(business && funding.status === "held" && focused && mode === "details" && !focused.decision.hold);
  const formError = query.error || null;
  const draftNote = query.draftNote || "";
  const draftLink = query.draftLink || "";
  const waitingVersion =
    focused?.decision.action.kind === "review" ? focused.decision.action.version : null;
  const waitingSubmission =
    waitingVersion != null
      ? focused?.milestone.state.submissions.find((row) => row.version === waitingVersion) ?? null
      : null;
  const reviewFiles =
    waitingVersion != null
      ? (focused?.milestone.reviewFiles.filter((file) => file.version === waitingVersion) ?? [])
      : [];

  return (
    <WorkspaceFrame>
      <WorkspaceScroll fundingId={funding.id} />
      <div className="min-w-0 rounded-3xl border border-[#E6ECF7] bg-white p-4 sm:p-6">
        <p className="text-sm text-[#667085]">
          <a href={collaborationsHref} className="font-semibold text-[#6D4AFF] hover:underline">
            Collaborations
          </a>
          <span> / Workspace</span>
        </p>
        <h1 className="mt-3 break-words font-display text-3xl font-bold text-[#1B1464]">{funding.title}</h1>
        <p className="mt-1 text-sm text-[#667085]">
          {counterparty} · {fundingStatusLabel(funding.status)}
        </p>
        {summary.length > 0 ? (
          <dl className="mt-5 grid gap-4 border-y border-[#E6ECF7] py-4 sm:grid-cols-3">
            {summary.map((line) => (
              <div key={line.label}>
                <dt className="text-xs text-[#667085]">{line.label}</dt>
                <dd className="mt-1 font-display text-2xl font-bold text-[#1B1464]">{line.amount}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-4 text-sm text-[#667085]">The signed amounts for this collaboration are not on the record yet.</p>
        )}
        {funding.status !== "held" && funding.status !== "completed" ? (
          <p className="mt-3 text-sm text-[#1B1464]">Deliverables open after funding is confirmed. The influencer has not been paid.</p>
        ) : null}
        <div className="mt-4">
          <WorkspaceTabs
            active={tab}
            agreementHref={contractHref}
            paymentsHref="/payments"
            tabs={[
              { id: "milestones", label: "Milestones", href: tabHref("milestones") },
              { id: "files", label: "Files", href: tabHref("files") },
              { id: "brief", label: "Brief", href: tabHref("brief") },
              { id: "messages", label: "Messages", href: tabHref("messages") },
            ]}
          />
        </div>
        {notices.map((notice) => (
          <p key={notice.text} className={`mt-4 text-sm font-semibold ${notice.tone === "error" ? "text-amber-900" : "text-emerald-700"}`}>
            {notice.text}
          </p>
        ))}
        {query.savedAs && !focused ? (
          <p className="mt-4 rounded-xl bg-[#EAF8F2] px-3 py-2 text-sm font-semibold text-[#087B5A]">Saved as {query.savedAs}</p>
        ) : null}
        {query.release && focused && !showRelease ? (
          <p className="mt-4 text-sm text-amber-900">That version is not the one waiting for review. Nothing was released.</p>
        ) : null}
        {tab === "milestones" ? (
          <div className="mt-2">
            {milestones.length === 0 ? <p className="py-6 text-sm text-[#667085]">This agreement has no milestones.</p> : null}
            <section id="milestones">
              <WorkspaceMilestoneTable
                amountHeading={amountHeading}
                dimmed={Boolean(focused)}
                rows={decisions.map(({ milestone, decision }) => ({
                  id: milestone.id,
                  name: milestone.title,
                  amount: milestone.amountLabel,
                  workStatus: decision.workStatus,
                  workTone: decision.workTone,
                  paymentStatus: decision.paymentStatus,
                  bankLine: decision.bankLine,
                  actionLabel: decision.action.label,
                  actionHref:
                    decision.action.kind === "recover_payout" || decision.action.kind === "view_payment"
                      ? decision.action.href
                      : workspaceHref(funding.id, {
                          tab,
                          focus: milestone.id,
                          intent: intentFor(decision.action.kind),
                          ...(decision.action.kind === "review" ? { version: String(decision.action.version) } : {}),
                        }),
                  nextActor: decision.nextActor,
                  note: decision.hold ? decision.holdReason : milestone.disputeNote,
                }))}
              />
            </section>
          </div>
        ) : null}
        {tab === "files" ? (
          <div id="files" className="mt-4">
            {files.length === 0 ? <p className="text-sm text-[#667085]">No files yet.</p> : (
              <ul className="space-y-2 text-sm">
                {files.map((file) => (
                  <li key={file.id}>
                    <a href={`/api/deliverables/${file.id}`} className="font-semibold text-[#6D4AFF] hover:underline">
                      {file.fileName}
                    </a>
                    <span className="text-[#667085]"> · {file.milestoneTitle}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
        {tab === "brief" ? (
          <div id="brief" className="mt-4 space-y-2 text-sm text-[#344054]">
            <p className="font-semibold text-[#1B1464]">{funding.title}</p>
            <p>{briefScope || "The brief is the signed agreement."}</p>
            {contractHref ? (
              <p>
                <a href={contractHref} className="font-semibold text-[#6D4AFF] hover:underline">
                  View agreement
                </a>
              </p>
            ) : null}
          </div>
        ) : null}
        {tab === "messages" ? <WorkspaceMessages fundingId={funding.id} /> : null}
      </div>
      {showRelease && focused ? (
        <ReleaseStep
          fundingId={funding.id}
          milestoneId={focused.milestone.id}
          milestoneName={focused.milestone.title}
          version={releaseVersion}
          currency={funding.currency}
          grossCents={focused.milestone.grossCents}
          businessFeeCents={focused.milestone.businessFeeCents}
          closeHref={closeHref}
          changesHref={workspaceHref(funding.id, {
            tab,
            focus: focused.milestone.id,
            intent: "review",
            version: String(releaseVersion),
            review: "changes",
          })}
          tab={tab}
          linkUrl={waitingSubmission?.linkUrl || null}
          note={waitingSubmission?.note || null}
          files={reviewFiles.map((file) => ({ id: file.id, fileName: file.fileName }))}
        />
      ) : null}
      {focused && mode && !showRelease ? (
        <FocusDialog closeHref={closeHref}>
          <WorkspaceDialogBody
            title={dialogTitle(focused.milestone.title, focused.decision, mode, reviewStep)}
            subtitle={dialogSubtitle(focused.milestone.title, focused.decision, mode)}
            closeHref={closeHref}
            feedback={mode === "submit" ? focused.decision.feedback : mode === "review" ? focused.decision.feedback : null}
            history={focused.decision.history}
            paymentHistory={focused.decision.paymentHistory}
            holdReason={focused.decision.holdReason}
            bankLine={focused.decision.bankLine}
            mode={mode}
            reviewStep={mode === "review" ? reviewStep : "hub"}
            showSubmitForm={showSubmitForm}
            submitLabel={focused.decision.action.kind === "submit_first" || focused.decision.action.kind === "submit_revision" ? `Submit version ${focused.decision.action.version}` : null}
            reviewVersion={focused.decision.action.kind === "review" ? focused.decision.action.version : null}
            canRequestChanges={focused.decision.canRequestChanges}
            requestChangesHref={
              focused.decision.action.kind === "review"
                ? workspaceHref(funding.id, {
                    tab,
                    focus: focused.milestone.id,
                    intent: "review",
                    version: String(focused.decision.action.version),
                    review: "changes",
                  })
                : null
            }
            reviewHubHref={
              focused.decision.action.kind === "review"
                ? workspaceHref(funding.id, {
                    tab,
                    focus: focused.milestone.id,
                    intent: "review",
                    version: String(focused.decision.action.version),
                  })
                : null
            }
            approveHref={
              focused.decision.action.kind === "review"
                ? workspaceHref(funding.id, {
                    tab,
                    focus: focused.milestone.id,
                    release: focused.milestone.id,
                    version: String(focused.decision.action.version),
                  })
                : null
            }
            reviewSummary={
              waitingSubmission
                ? {
                    note: waitingSubmission.note || null,
                    linkUrl: waitingSubmission.linkUrl || null,
                    files: reviewFiles.map((file) => ({ id: file.id, fileName: file.fileName })),
                  }
                : null
            }
            dealId={funding.id}
            milestoneId={focused.milestone.id}
            tab={tab}
            submitAction={actionSubmitMilestone}
            reviseAction={actionRequestRevision}
            filesAction={actionAddDeliverableFiles}
            showBusinessFiles={showBusinessFiles}
            draftNote={draftNote}
            draftLink={draftLink}
            formError={formError}
          />
        </FocusDialog>
      ) : null}
    </WorkspaceFrame>
  );
}

function intentFor(kind: string) {
  if (kind === "submit_first" || kind === "submit_revision") return "submit";
  if (kind === "review") return "review";
  return "details";
}

function focusMode(kind: string | undefined, intent: string | undefined, showRelease: boolean): "submit" | "review" | "details" | null {
  if (!kind || showRelease) return null;
  if (intent === "submit" && (kind === "submit_first" || kind === "submit_revision")) return "submit";
  if (intent === "review" && kind === "review") return "review";
  return "details";
}

function dialogTitle(
  name: string,
  decision: ReturnType<typeof workspaceDecision>,
  mode: "submit" | "review" | "details",
  reviewStep: "hub" | "changes" = "hub",
) {
  if (mode === "submit" && decision.action.kind === "submit_revision") return "Submit a revision";
  if (mode === "submit") return "Submit a version";
  if (mode === "review" && decision.action.kind === "review" && reviewStep === "changes") {
    return `Request changes · version ${decision.action.version}`;
  }
  if (mode === "review" && decision.action.kind === "review") return `Review version ${decision.action.version}`;
  return name;
}

function dialogSubtitle(name: string, decision: ReturnType<typeof workspaceDecision>, mode: "submit" | "review" | "details") {
  if (mode === "submit" && (decision.action.kind === "submit_first" || decision.action.kind === "submit_revision")) {
    return `${name} · Version ${decision.action.version}`;
  }
  if (mode === "review" && decision.action.kind === "review") return `${name} · Version ${decision.action.version}`;
  if (decision.hold) return "Recorded history";
  return "Version history";
}
