"use client";

import { useMemo, useState } from "react";
import { proposeContractClauseChange, type ContractAiSection } from "@/lib/contract-ai-tailor";

export function ContractAiReviewDialog({
  open,
  onClose,
  section,
  original,
  dealSigned,
  brand,
  influencer,
  onAccept,
}: {
  open: boolean;
  onClose: () => void;
  section: ContractAiSection;
  original: string;
  dealSigned: boolean;
  brand: string;
  influencer: string;
  onAccept: (proposed: string) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const proposal = useMemo(
    () =>
      proposeContractClauseChange({
        section,
        original,
        instruction: instruction || "Make the deliverables more precise.",
        dealSigned,
        protectedParties: { brand, influencer },
      }),
    [section, original, instruction, dealSigned, brand, influencer],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1B1464]/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="ai-review-title" className="w-full max-w-2xl rounded-[28px] bg-white shadow-xl">
        <div className="border-b border-[#EEF2F7] px-6 py-4">
          <h2 id="ai-review-title" className="font-display text-xl font-bold text-[#1B1464]">
            Review AI changes
          </h2>
          <p className="mt-1 text-sm text-[#667085]">Check the proposed change and decide whether to accept it.</p>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
            <div className="rounded-2xl bg-[#F4F6FB] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">Original</p>
              <p className="mt-2 text-sm text-[#1B1464]">{proposal.original}</p>
            </div>
            <span className="hidden text-center text-[#6D4AFF] sm:block" aria-hidden>
              →
            </span>
            <div className="rounded-2xl bg-[#F3EEFF] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6D4AFF]">Proposed</p>
              <p className="mt-2 text-sm text-[#1B1464]">{proposal.proposed}</p>
            </div>
          </div>
          <label className="block text-sm">
            <span className="font-semibold text-[#1B1464]">Ask AI</span>
            <input
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="Refine this change (e.g., adjust length, format, or wording)."
              className="mt-2 h-11 w-full rounded-full border border-[#E7ECF5] bg-[#F8FAFC] px-4 outline-none"
            />
          </label>
          {proposal.message ? <p className="text-sm text-[#667085]">{proposal.message}</p> : null}
          <div className="rounded-2xl border border-[#E7ECF5] bg-[#FBFCFE] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">Parties from collaboration · Protected (not editable)</p>
            <p className="mt-2 text-sm text-[#667085]">The party identities for this collaboration are locked and cannot be edited by AI.</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-[#F3EEFF] px-2.5 py-1 text-[#6D4AFF]">Brand: {brand}</span>
              <span className="rounded-full bg-[#F3EEFF] px-2.5 py-1 text-[#6D4AFF]">Influencer: {influencer}</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#EEF2F7] px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-full border border-[#E7ECF5] px-4 py-2 text-sm font-semibold text-[#344054]">
            Discard
          </button>
          <button
            type="button"
            disabled={proposal.kind !== "wording"}
            onClick={() => {
              if (proposal.kind !== "wording") return;
              onAccept(proposal.proposed);
              onClose();
            }}
            className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white disabled:bg-[#E7ECF5] disabled:text-[#98A2B3]"
          >
            {proposal.kind === "financial_requires_quote"
              ? "Revise quote"
              : proposal.kind === "financial_requires_change_order"
                ? "Create change order"
                : "Accept change"}
          </button>
        </div>
      </div>
    </div>
  );
}
