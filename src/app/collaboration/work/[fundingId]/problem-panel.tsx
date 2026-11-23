import { actionAddEvidence, actionOpenDispute } from "@/app/payments/actions";

export type ProblemDispute = {
  id: string;
  milestoneTitle: string;
  reason: string;
  status: string;
  openedByYou: boolean;
  evidenceUsed: number;
  evidenceLimit: number;
  notes: { author: string; body: string; url: string | null; at: string }[];
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open · waiting for review",
  under_review: "Under review by Influrios",
  refund_requested: "Refund requested",
  escalated_provider: "With the payment provider",
  escalated_legal: "Escalated",
};

/**
 * Members report a problem on a milestone (a dispute holds that milestone's payout) and add
 * evidence while it is open. Cancelling the whole collaboration goes through Settlement.
 */
export function ProblemPanel({
  fundingId,
  canOpen,
  openable,
  reasons,
  disputes,
  settlementHref,
}: {
  fundingId: string;
  canOpen: boolean;
  openable: { id: string; title: string }[];
  reasons: { id: string; label: string }[];
  disputes: ProblemDispute[];
  settlementHref: string;
}) {
  const returnTo = `/collaboration/work/${fundingId}`;
  return (
    <section id="problems" className="mt-8 space-y-4 border-t border-[#E6ECF7] pt-6">
      <div>
        <h2 className="font-display text-lg font-bold text-[#1B1464]">Problems and disputes</h2>
        <p className="mt-1 text-sm text-[#667085]">
          Try Messages first. If you can&apos;t agree, report a problem: the milestone&apos;s payout is held until Influrios reviews it.
        </p>
      </div>

      {disputes.map((dispute) => {
        const roomLeft = dispute.evidenceUsed < dispute.evidenceLimit;
        return (
          <div key={dispute.id} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
            <p className="text-sm font-semibold text-[#1B1464]">
              {dispute.milestoneTitle} · {dispute.reason}
            </p>
            <p className="mt-0.5 text-xs text-[#667085]">
              {STATUS_LABEL[dispute.status] ?? dispute.status} · opened by {dispute.openedByYou ? "you" : "the other party"} · evidence{" "}
              {dispute.evidenceUsed} of {dispute.evidenceLimit}
            </p>
            {dispute.notes.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm">
                {dispute.notes.map((note, index) => (
                  <li key={index} className="rounded-xl bg-white px-3 py-2">
                    <p className="text-xs text-[#667085]">
                      {note.author} · {note.at}
                    </p>
                    <p className="whitespace-pre-wrap text-[#344054]">{note.body}</p>
                    {note.url ? (
                      <a href={note.url} target="_blank" rel="noreferrer noopener" className="text-xs font-semibold text-[#6D4AFF] hover:underline">
                        {note.url}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {roomLeft ? (
              <form action={actionAddEvidence} className="mt-3 space-y-2">
                <input type="hidden" name="dealId" value={fundingId} />
                <input type="hidden" name="disputeId" value={dispute.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <label className="block text-xs font-semibold text-[#667085]">
                  Add evidence
                  <textarea
                    name="body"
                    required
                    minLength={8}
                    maxLength={2000}
                    rows={3}
                    className="mt-1 w-full rounded-xl border border-[#D0D5DD] px-3 py-2 text-sm font-normal text-[#1B1464]"
                    placeholder="What happened, with dates. Influrios reviews this."
                  />
                </label>
                <label className="block text-xs font-semibold text-[#667085]">
                  Link (optional, https)
                  <input
                    name="url"
                    type="url"
                    className="mt-1 w-full rounded-xl border border-[#D0D5DD] px-3 py-2 text-sm font-normal text-[#1B1464]"
                    placeholder="https://"
                  />
                </label>
                <button type="submit" className="inline-flex h-10 items-center rounded-full bg-[#1B1464] px-4 text-sm font-semibold text-white">
                  Add evidence
                </button>
              </form>
            ) : (
              <p className="mt-3 text-xs text-[#667085]">This dispute has used its evidence limit. Influrios will decide from what is on file.</p>
            )}
          </div>
        );
      })}

      {canOpen && openable.length > 0 && reasons.length > 0 ? (
        <details className="rounded-2xl border border-[#E6ECF7] p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[#1B1464]">Report a problem with a milestone</summary>
          <form action={actionOpenDispute} className="mt-3 space-y-3">
            <input type="hidden" name="dealId" value={fundingId} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <label className="block text-xs font-semibold text-[#667085]">
              Milestone
              <select name="milestoneId" required className="mt-1 w-full rounded-xl border border-[#D0D5DD] px-3 py-2 text-sm font-normal text-[#1B1464]">
                {openable.map((milestone) => (
                  <option key={milestone.id} value={milestone.id}>
                    {milestone.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-[#667085]">
              Reason
              <select name="reasonId" required defaultValue="" className="mt-1 w-full rounded-xl border border-[#D0D5DD] px-3 py-2 text-sm font-normal text-[#1B1464]">
                <option value="" disabled>
                  Choose a reason
                </option>
                {reasons.map((reason) => (
                  <option key={reason.id} value={reason.id}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-[#667085]">
              What went wrong
              <textarea
                name="details"
                required
                minLength={8}
                maxLength={2000}
                rows={4}
                className="mt-1 w-full rounded-xl border border-[#D0D5DD] px-3 py-2 text-sm font-normal text-[#1B1464]"
              />
            </label>
            <p className="text-xs text-[#667085]">The other party is told, and this milestone&apos;s payout is held until it is resolved.</p>
            <button type="submit" className="inline-flex h-10 items-center rounded-full bg-[#B42318] px-4 text-sm font-semibold text-white">
              Report problem
            </button>
          </form>
        </details>
      ) : null}

      <p className="text-sm text-[#667085]">
        Want to end the whole collaboration?{" "}
        <a href={settlementHref} className="font-semibold text-[#6D4AFF] hover:underline">
          Request a cancellation
        </a>
        .
      </p>
    </section>
  );
}
