"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { actionRespondToInvitation } from "@/app/collaboration/applications/actions";
import { AccountDialog } from "@/components/account-dialog";
import type { InviteeInvitationView } from "@/lib/invitation-turn";

export type InvitationReviewRow = {
  id: string;
  brand: string;
  title: string;
  deliverables: string;
  budget: string;
  deadline: string;
  status: string;
  view: InviteeInvitationView;
};

const TONE: Record<InviteeInvitationView["tone"], string> = {
  violet: "bg-[#F1EDFF] text-[#5B3FE0]",
  blue: "bg-[#EAF2FF] text-[#2F5FD0]",
  green: "bg-[#E8F8EE] text-[#178A45]",
  gray: "bg-[#F2F4F7] text-[#475467]",
};

export function InvitationStatusPill({ view }: { view: InviteeInvitationView }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[view.tone]}`}>{view.label}</span>;
}

function Submit({ children, tone }: { children: React.ReactNode; tone: "primary" | "secondary" | "danger" }) {
  const { pending } = useFormStatus();
  const cls =
    tone === "primary"
      ? "bg-[#6D4AFF] text-white"
      : tone === "danger"
        ? "border border-[#F4C7CF] text-[#C0314B]"
        : "border border-[#E4E9F5] text-[#1B1464]";
  return (
    <button type="submit" disabled={pending} className={`rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${cls}`}>
      {children}
    </button>
  );
}

function intentCopy(view: InviteeInvitationView, brand: string) {
  switch (view.kase) {
    case 1:
      return `${brand} invited you. Tell them if you're interested, ask a question, or decline.`;
    case 2:
      return `${brand} has been notified. Their answer will appear here, and you'll get a notification.`;
    case 3:
      return `Let ${brand} know how you'd like to continue.`;
    case 4:
    case 6:
      return `You told ${brand} you're interested. This isn't an agreement yet. They'll send one if they choose you.`;
    case 5:
      return `${brand} still decides on the invitation. Their answer will appear here, and you'll get a notification.`;
    default:
      if (view.closedAs === "accepted") return `${brand} accepted you and is preparing the agreement. You don't need to do anything yet.`;
      if (view.closedAs === "declined") return "You declined this invitation. Nothing was signed or funded.";
      if (view.closedAs === "withdrawn") return `${brand} withdrew this invitation.`;
      return "This invitation has expired. Nothing was signed or funded.";
  }
}

/**
 * The invitee's response panel. Rendered identically in the hub popup and on the
 * invitation detail page (P1-AUD-10), driven only by the §2.2b case from the server.
 */
export function InvitationResponsePanel({
  id,
  brand,
  view,
  returnTo,
}: {
  id: string;
  brand: string;
  view: InviteeInvitationView;
  returnTo: string;
}) {
  const [asking, setAsking] = useState(false);
  const askLabel =
    view.actions.ask === "another" ? "Ask another question" : view.actions.ask === "follow-up" ? "Ask a follow-up question" : "Ask a question";
  const hidden = (
    <>
      <input type="hidden" name="applicationId" value={id} />
      <input type="hidden" name="returnTo" value={returnTo} />
    </>
  );
  return (
    <div data-invitation-case={String(view.kase)}>
      <div className="flex flex-wrap items-center gap-2">
        <InvitationStatusPill view={view} />
      </div>
      <p className="mt-3 text-sm text-[#344054]">{intentCopy(view, brand)}</p>
      {view.question ? (
        <p className="mt-3 rounded-xl border border-[#E4E9F5] px-3 py-2 text-xs text-[#1B1464]">
          <span className="font-semibold">You asked: </span>“{view.question}”
        </p>
      ) : null}
      {view.answer ? (
        <p className="mt-2 rounded-xl border border-[#E4E9F5] bg-[#F8F6FF] px-3 py-2 text-xs text-[#1B1464]">
          <span className="font-semibold">{brand} replied: </span>“{view.answer}”
        </p>
      ) : null}
      {view.closedAs === "withdrawn" ? (
        <>
          {view.withdrawnReason ? (
            <p className="mt-3 rounded-xl border border-[#E4E9F5] px-3 py-2 text-xs text-[#344054]">
              <span className="font-semibold">Reason given: </span>“{view.withdrawnReason}”
            </p>
          ) : null}
          {view.withdrawnMessage ? (
            <p className="mt-2 rounded-xl bg-[#F8F6FF] px-3 py-2 text-xs text-[#344054]">“{view.withdrawnMessage}”</p>
          ) : null}
          <p className="mt-2 text-sm text-[#344054]">Nothing was signed or funded.</p>
        </>
      ) : null}
      {view.kase !== "closed" ? (
        <p className="mt-3 rounded-xl bg-[#F8F6FF] px-3 py-2 text-xs text-[#5C657F]">
          Replying doesn&apos;t sign a contract or start a payment. Only {brand} can accept.
        </p>
      ) : null}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {view.actions.decline ? (
          <form action={actionRespondToInvitation}>
            {hidden}
            <input type="hidden" name="intent" value="decline" />
            <Submit tone="danger">Decline</Submit>
          </form>
        ) : null}
        {view.actions.ask && !asking ? (
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="rounded-full border border-[#E4E9F5] px-4 py-2 text-sm font-semibold text-[#1B1464]"
          >
            {askLabel}
          </button>
        ) : null}
        {view.actions.interested ? (
          <form action={actionRespondToInvitation}>
            {hidden}
            <input type="hidden" name="intent" value="interested" />
            <Submit tone="primary">I&apos;m interested</Submit>
          </form>
        ) : null}
      </div>
      {view.actions.ask && asking ? (
        <form action={actionRespondToInvitation} className="mt-3 space-y-2">
          {hidden}
          <input type="hidden" name="intent" value="question" />
          <label className="block text-xs font-semibold text-[#667085]">
            {askLabel}
            <textarea name="note" required minLength={8} maxLength={500} rows={3} className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-2 text-sm text-[#1B1464]" />
          </label>
          <div className="flex justify-end">
            <Submit tone="primary">Send question</Submit>
          </div>
        </form>
      ) : null}
    </div>
  );
}

export function InvitationReview({ rows, initialOpenId = null }: { rows: InvitationReviewRow[]; initialOpenId?: string | null }) {
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const open = rows.find((row) => row.id === openId) ?? null;

  return (
    <>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-[#667085]">No invitations are waiting. Applications you send stay in Applications.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[#EEF2F7]">
          {rows.map((row) => {
            const yours = row.view.kase === 1 || row.view.kase === 3;
            return (
              <li key={row.id} className="flex flex-wrap items-center gap-3 py-3" data-invitation-row={row.id}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[#1B1464]">{row.title}</p>
                  <p className="text-xs text-[#667085]">
                    {row.brand}
                    {row.deadline ? ` · Reply by ${row.deadline.slice(0, 10)}` : ""}
                  </p>
                  <div className="mt-1.5">
                    <InvitationStatusPill view={row.view} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpenId(row.id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    yours ? "bg-[#6D4AFF] text-white" : "border border-[#E4E9F5] text-[#1B1464]"
                  }`}
                >
                  {yours ? "Review" : "Open"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {open ? (
        <AccountDialog title={open.title} subtitle={`${open.brand} · Invitation`} onClose={() => setOpenId(null)}>
          <dl className="mb-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-[#667085]">Proposed fee</dt><dd className="font-semibold text-[#1B1464]">{open.budget || "Shown in the quote"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[#667085]">Reply by</dt><dd className="font-semibold text-[#1B1464]">{open.deadline ? open.deadline.slice(0, 10) : "—"}</dd></div>
          </dl>
          <p className="mb-4 text-sm text-[#344054]">{open.deliverables || "The brief is on the invitation. Final fees appear on the quote."}</p>
          <InvitationResponsePanel
            id={open.id}
            brand={open.brand}
            view={open.view}
            returnTo="/collaboration/hub?view=collaborations&tab=invitations"
          />
          <div className="mt-4 text-right">
            <Link href={`/collaboration/applications/${open.id}`} className="text-xs font-semibold text-[#6D4AFF]">
              Open full invitation →
            </Link>
          </div>
        </AccountDialog>
      ) : null}
    </>
  );
}
