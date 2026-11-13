"use client";

import { useState } from "react";
import Link from "next/link";
import { actionRespondToInvitation } from "@/app/collaboration/applications/actions";

export type InvitationReviewRow = {
  id: string;
  brand: string;
  title: string;
  deliverables: string;
  budget: string;
  deadline: string;
  status: string;
};

export function InvitationReview({ rows }: { rows: InvitationReviewRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const open = rows.find((row) => row.id === openId) ?? null;
  const canRespond = open ? open.status === "REQUESTED" || open.status === "VIEWED" || open.status === "RESPONDED" || open.status === "NEGOTIATING" : false;

  return (
    <>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-[#667085]">No invitations are waiting. Applications you send stay in Applications.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-[#98A2B3]">
              <tr>
                <th className="py-2 pr-3 font-semibold">Opportunity</th>
                <th className="py-2 pr-3 font-semibold">Business</th>
                <th className="py-2 pr-3 font-semibold">Respond by</th>
                <th className="py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-[#EEF2F7]">
                  <td className="py-3 pr-3 font-semibold text-[#1B1464]">{row.title}</td>
                  <td className="py-3 pr-3 text-[#667085]">{row.brand}</td>
                  <td className="py-3 pr-3 text-[#667085]">{row.deadline || "—"}</td>
                  <td className="py-3">
                    <button type="button" onClick={() => { setAsking(false); setOpenId(row.id); }} className="rounded-full bg-[#6D4AFF] px-3 py-1.5 text-xs font-semibold text-white">
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open ? (
        <div className="fixed inset-0 z-50">
          <button type="button" aria-label="Close invitation" className="absolute inset-0 bg-[#1B1464]/40" onClick={() => setOpenId(null)} />
          <div role="dialog" aria-modal="true" aria-labelledby="invite-title" className="absolute left-1/2 top-1/2 w-[min(32rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#6D4AFF]">{open.brand}</p>
                <h2 id="invite-title" className="font-display text-2xl font-bold text-[#1B1464]">{open.title}</h2>
              </div>
              <button type="button" aria-label="Close" onClick={() => setOpenId(null)} className="text-xl text-[#667085]">×</button>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-[#667085]">Proposed gross</dt><dd className="font-semibold text-[#1B1464]">{open.budget || "Shown in the quote"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[#667085]">Respond by</dt><dd className="font-semibold text-[#1B1464]">{open.deadline || "—"}</dd></div>
            </dl>
            <p className="mt-3 text-sm text-[#344054]">{open.deliverables || "The brief is on the invitation. Final fees appear on the quote."}</p>
            <p className="mt-3 rounded-xl bg-[#F8F6FF] px-3 py-2 text-xs text-[#5C657F]">
              Responding does not sign a contract or start a payment. You only see your own invitation.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {canRespond && (open.status === "REQUESTED" || open.status === "VIEWED") ? (
                <form action={actionRespondToInvitation}>
                  <input type="hidden" name="applicationId" value={open.id} />
                  <input type="hidden" name="intent" value="interested" />
                  <button type="submit" className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">Interested</button>
                </form>
              ) : null}
              {canRespond && !asking ? (
                <button type="button" onClick={() => setAsking(true)} className="rounded-full border border-[#E4E9F5] px-4 py-2 text-sm font-semibold text-[#1B1464]">
                  Ask a question
                </button>
              ) : null}
              {canRespond ? (
                <form action={actionRespondToInvitation}>
                  <input type="hidden" name="applicationId" value={open.id} />
                  <input type="hidden" name="intent" value="decline" />
                  <button type="submit" className="rounded-full border border-[#E4E9F5] px-4 py-2 text-sm font-semibold text-[#1B1464]">Decline</button>
                </form>
              ) : (
                <Link href={`/collaboration/applications/${open.id}`} className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">
                  Open invitation
                </Link>
              )}
            </div>
            {canRespond && asking ? (
              <form action={actionRespondToInvitation} className="mt-3 space-y-2">
                <input type="hidden" name="applicationId" value={open.id} />
                <input type="hidden" name="intent" value="question" />
                <label className="block text-xs font-semibold text-[#667085]">
                  Question
                  <textarea name="note" required minLength={8} rows={3} className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-2 text-sm text-[#1B1464]" />
                </label>
                <button type="submit" className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">Send question</button>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
