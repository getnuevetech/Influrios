"use client";

import { useState } from "react";
import {
  actionAcceptSettlement,
  actionCancelPrefund,
  actionDisputeSettlement,
  actionQuestionSettlement,
  actionRequestCancellation,
} from "@/app/payments/actions";

type Proposal = {
  influencerNetCents: number;
  platformRetainedCents: number;
  retainedInfluencerFeeCents: number;
  businessRefundCents: number;
};

type Question = { party: "business" | "influencer"; body: string };

function moneyLabel(cents: number, currency: string) {
  const formatted = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(cents / 100);
  return `${currency} ${formatted}`;
}

export function SettlementReview({
  dealId,
  currency,
  fundingStatus,
  party,
  reasons,
  collectedCents,
  releasedCents,
  proposal,
  versionNumber,
  settlementStatus,
  acceptedByBusiness,
  acceptedByInfluencer,
  disputed,
  disputeNote,
  questions,
}: {
  dealId: string;
  currency: string;
  fundingStatus: string;
  party: "business" | "influencer";
  reasons: { id: string; label: string }[];
  collectedCents: number;
  releasedCents: number;
  proposal: Proposal | null;
  versionNumber: number | null;
  settlementStatus: string | null;
  acceptedByBusiness: boolean;
  acceptedByInfluencer: boolean;
  disputed: boolean;
  disputeNote: string | null;
  questions: Question[];
}) {
  const [mode, setMode] = useState<"review" | "question" | "dispute">("review");
  const mine = party === "business" ? acceptedByBusiness : acceptedByInfluencer;
  const both = acceptedByBusiness && acceptedByInfluencer;
  const open = settlementStatus === "proposed" || settlementStatus === "accepted";

  return (
    <div className="space-y-3 text-sm text-[#344054]">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg font-bold text-[#1B1464]">Review cancellation proposal</h3>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
          {disputed ? "Disputed" : (settlementStatus ?? "No open proposal")}
        </span>
      </div>
      <p>Accepting this proposal does not confirm a refund. Cancellation status and refund status update separately.</p>
      {proposal && versionNumber != null ? (
        <dl className="space-y-2 rounded-2xl border border-[#E7ECF5] p-4">
          <div className="flex justify-between gap-3">
            <dt className="text-[#667085]">Version</dt>
            <dd className="font-semibold text-[#1B1464]">{versionNumber}</dd>
          </div>
          {party === "business" ? (
            <>
              <div className="flex justify-between gap-3">
                <dt className="text-[#667085]">Collected</dt>
                <dd className="font-semibold text-[#1B1464]">{moneyLabel(collectedCents, currency)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#667085]">Already paid</dt>
                <dd className="font-semibold text-[#1B1464]">{moneyLabel(releasedCents, currency)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#667085]">Work accepted</dt>
                <dd className="font-semibold text-[#1B1464]">{moneyLabel(proposal.influencerNetCents, currency)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#667085]">Retained fees</dt>
                <dd className="font-semibold text-[#1B1464]">{moneyLabel(proposal.platformRetainedCents, currency)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#667085]">Proposed refund</dt>
                <dd className="font-semibold text-[#1B1464]">{moneyLabel(proposal.businessRefundCents, currency)}</dd>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between gap-3">
                <dt className="text-[#667085]">Accepted net</dt>
                <dd className="font-semibold text-[#1B1464]">{moneyLabel(proposal.influencerNetCents, currency)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#667085]">Retained collaboration fee</dt>
                <dd className="font-semibold text-[#1B1464]">{moneyLabel(proposal.retainedInfluencerFeeCents, currency)}</dd>
              </div>
            </>
          )}
        </dl>
      ) : (
        <p className="text-[#667085]">No cancellation proposal is open. Requesting a review does not move money.</p>
      )}
      {disputed ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
          This proposal is disputed{disputeNote ? `: ${disputeNote}` : ""}. A new version is required before it can be accepted. Nothing was refunded.
        </p>
      ) : null}
      {settlementStatus === "accepted" && both ? (
        <p className="text-[#667085]">Both parties accepted this version. A refund is not confirmed until finance executes it.</p>
      ) : null}
      {settlementStatus === "executed" ? (
        <p className="text-[#667085]">This settlement was sent. Cancellation status and refund status stay separate.</p>
      ) : null}
      {questions.length > 0 ? (
        <ul className="space-y-2">
          {questions.map((question, index) => (
            <li key={`${question.party}-${index}`} className="rounded-2xl border border-[#E7ECF5] px-4 py-3">
              <p className="text-xs font-semibold text-[#667085]">{question.party === "business" ? "Business" : "Influencer"}</p>
              <p className="mt-1 text-[#1B1464]">{question.body}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {fundingStatus === "awaiting_provider" && party === "business" ? (
        <form action={actionCancelPrefund} className="space-y-2">
          <input type="hidden" name="dealId" value={dealId} />
          <p className="text-xs text-[#667085]">
            This cancels the future obligation before the provider confirms the hold. A pending or unknown charge blocks it. A confirmed hold is not refunded here.
          </p>
          <button type="submit" className="rounded-full border border-[#E4E7EC] px-4 py-2 text-sm font-semibold text-[#344054]">
            Cancel future obligation
          </button>
        </form>
      ) : null}
      {fundingStatus === "awaiting_provider" && party === "influencer" ? (
        <p className="text-xs text-[#667085]">The business can cancel this obligation before the provider confirms the hold.</p>
      ) : null}
      {fundingStatus === "payment_risk" ? (
        <p className="text-xs text-[#667085]">This funding is paused. A cancellation proposal is not opened from this screen. Nothing was refunded.</p>
      ) : null}
      {fundingStatus === "held" && !open ? (
        <form action={actionRequestCancellation} className="space-y-3">
          <input type="hidden" name="dealId" value={dealId} />
          <label className="block text-xs font-semibold text-[#667085]">
            Reason
            <select name="reason" required className="mt-1 w-full rounded-xl border border-[#E6ECF7] px-3 py-2 text-sm text-[#1B1464]">
              <option value="">Choose a reason</option>
              {reasons.map((reason) => (
                <option key={reason.id} value={reason.id}>
                  {reason.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-[#667085]">
            Note
            <textarea name="note" rows={3} className="mt-1 w-full rounded-xl border border-[#E6ECF7] px-3 py-2 text-sm text-[#1B1464]" />
          </label>
          <button type="submit" className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">
            Request cancellation
          </button>
        </form>
      ) : null}
      {open && versionNumber != null && !disputed && !mine ? (
        <form action={actionAcceptSettlement}>
          <input type="hidden" name="dealId" value={dealId} />
          <input type="hidden" name="versionNumber" value={versionNumber} />
          <button type="submit" className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">
            Accept proposal
          </button>
        </form>
      ) : null}
      {open && versionNumber != null && mode === "review" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("question")}
            className="rounded-full border border-[#E4E7EC] px-4 py-2 text-sm font-semibold text-[#344054]"
          >
            Ask a question
          </button>
          {settlementStatus === "proposed" && !disputed ? (
            <button
              type="button"
              onClick={() => setMode("dispute")}
              className="rounded-full border border-[#E4E7EC] px-4 py-2 text-sm font-semibold text-[#344054]"
            >
              Dispute proposal
            </button>
          ) : null}
        </div>
      ) : null}
      {open && versionNumber != null && mode === "question" ? (
        <form action={actionQuestionSettlement} className="space-y-2">
          <input type="hidden" name="dealId" value={dealId} />
          <input type="hidden" name="versionNumber" value={versionNumber} />
          <label className="block text-xs font-semibold text-[#667085]">
            Question
            <textarea name="body" required minLength={8} rows={3} className="mt-1 w-full rounded-xl border border-[#E6ECF7] px-3 py-2 text-sm text-[#1B1464]" />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">
              Send question
            </button>
            <button type="button" onClick={() => setMode("review")} className="rounded-full px-4 py-2 text-sm font-semibold text-[#667085]">
              Back
            </button>
          </div>
        </form>
      ) : null}
      {settlementStatus === "proposed" && versionNumber != null && mode === "dispute" && !disputed ? (
        <form action={actionDisputeSettlement} className="space-y-2">
          <input type="hidden" name="dealId" value={dealId} />
          <input type="hidden" name="versionNumber" value={versionNumber} />
          <label className="block text-xs font-semibold text-[#667085]">
            What is disputed
            <textarea name="note" required minLength={8} rows={3} className="mt-1 w-full rounded-xl border border-[#E6ECF7] px-3 py-2 text-sm text-[#1B1464]" />
          </label>
          <p className="text-xs text-[#667085]">Disputing this proposal does not confirm a refund.</p>
          <div className="flex gap-2">
            <button type="submit" className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">
              Dispute proposal
            </button>
            <button type="button" onClick={() => setMode("review")} className="rounded-full px-4 py-2 text-sm font-semibold text-[#667085]">
              Back
            </button>
          </div>
        </form>
      ) : null}
      <p className="text-xs text-[#98A2B3]">If a payout is still with the provider, a new proposal waits for that outcome. Nothing is refunded from this screen.</p>
    </div>
  );
}
