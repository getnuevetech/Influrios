import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { actionPostContractMessage, actionSignNativeContract } from "@/app/collaboration/contracts/[id]/actions";
import { SignaturePad } from "@/components/signature-pad";
import { getAccountSession } from "@/lib/accounts";
import { getAdminSession } from "@/lib/admin-auth";
import {
  adminCanOpenContractMessages,
  messageVisible,
  resolveContractBodyForChrome,
  resolveContractPartyForAccount,
} from "@/lib/contract-document";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; sent?: string; signed?: string }>;
};

export default async function ContractDocumentPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const [account, admin, document] = await Promise.all([
    getAccountSession().catch(() => null),
    getAdminSession().catch(() => null),
    prisma.contractDocument.findUnique({
      where: { id },
      include: {
        parties: { orderBy: { createdAt: "asc" } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    }),
  ]);
  if (!document) notFound();
  let party = account ? resolveContractPartyForAccount(document.parties, account) : undefined;
  if (party && account && party.userId !== account.id) {
    await prisma.contractParty.update({ where: { id: party.id }, data: { userId: account.id } }).catch(() => undefined);
    party = { ...party, userId: account.id };
  }
  const adminOpen = admin
    ? adminCanOpenContractMessages(admin) ||
      admin.permissions.includes("contracts.manage") ||
      admin.permissions.includes("contracts.view")
    : false;
  if (!party && !adminOpen) redirect("/login?next=/collaboration/contracts/" + id);

  const viewer =
    party && account
      ? ({ kind: "party", userId: account.id, partyId: party.id } as const)
      : admin
        ? ({ kind: "admin", userId: admin.userId, roleId: admin.roleId, permissions: admin.permissions } as const)
        : null;
  const messages = viewer
    ? document.messages.filter((message) =>
        messageVisible({
          audience: message.audience,
          recipientPartyId: message.recipientPartyId,
          senderUserId: message.senderUserId,
          senderAdminId: message.senderAdminId,
          viewer,
        }),
      )
    : [];
  const canMessage = Boolean(
    party || (admin && (adminCanOpenContractMessages(admin) || admin.permissions.includes("contracts.manage"))),
  );
  const source =
    document.sourceJson && typeof document.sourceJson === "object"
      ? (document.sourceJson as Record<string, string>)
      : {};
  const returnQuery = new URLSearchParams({ ...source, contractDocument: document.id });
  const isNative = document.signingChannel === "native";
  const awaitingSignature = document.status === "sent" || document.status === "draft";
  const canSignNative = Boolean(party && isNative && awaitingSignature && party.status === "pending");
  const youSigned = Boolean(party && party.status === "signed");
  const pendingParties = document.parties.filter((row) => row.status === "pending");
  const signedCount = document.parties.filter((row) => row.status === "signed").length;
  const channelLabel = isNative
    ? "Influrios in-app"
    : document.envelopeId
      ? `DocuSign ${document.envelopeId}`
      : "DocuSign";

  // Old contracts must show the approved Influrios chrome template (persist when upgraded).
  const chrome = resolveContractBodyForChrome({
    id: document.id,
    title: document.title,
    status: document.status,
    renderedBody: document.renderedBody,
    signingChannel: document.signingChannel,
    createdAt: document.createdAt,
    parties: document.parties,
  });
  if (chrome.upgraded) {
    await prisma.contractDocument
      .update({
        where: { id: document.id },
        data: { renderedBody: chrome.body },
      })
      .catch(() => undefined);
  }
  const agreementBody = chrome.body;

  return (
    <div className="bg-[#F7FAFF]">
      <section className="border-b border-[#E4E9F5] bg-white">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet">Contract</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-indigo">{document.title}</h1>
          <p className="mt-2 text-sm text-muted">
            Status: <strong className="text-indigo">{document.status}</strong>
            {" · "}
            {channelLabel}
            {" · "}
            {signedCount}/{document.parties.length} signed
          </p>
          {awaitingSignature ? (
            <p className="mt-2 text-sm font-semibold text-indigo">
              {canSignNative
                ? "Your signature is required — use the form below."
                : isNative
                  ? youSigned
                    ? `Waiting on ${pendingParties.length} other ${pendingParties.length === 1 ? "party" : "parties"} to sign.`
                    : "Each party signs in Influrios by typing their legal name."
                  : "Complete your DocuSign envelope. This page tracks status for every party."}
            </p>
          ) : document.status === "signed" ? (
            <p className="mt-2 text-sm font-semibold text-emerald-700">Every party has signed. Funding can start.</p>
          ) : (
            <p className="mt-2 text-sm text-muted">This agreement is {document.status}.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
            {canSignNative ? (
              <a href="#sign" className="btn-primary !py-2 text-sm">
                Sign this agreement →
              </a>
            ) : null}
            <Link
              href={`/collaboration/contracts/${document.id}/pdf?v=chrome-v1`}
              className="text-violet hover:underline"
            >
              Download PDF
            </Link>
            {document.status === "signed" ? (
              <Link href={`/collaboration/contract?${returnQuery.toString()}`} className="text-violet hover:underline">
                Request funding
              </Link>
            ) : (
              <span className="text-muted">Funding waits until every party has signed.</span>
            )}
            <Link href="/account#contracts" className="text-violet hover:underline">
              Your account
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        {query.error ? <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{query.error}</p> : null}
        {query.signed === "1" ? (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            Every party has signed. Funding can start.
          </p>
        ) : null}
        {query.signed === "0" ? (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            Your signature was recorded. Waiting for the other parties — they were emailed a reminder.
          </p>
        ) : null}
        {query.sent ? <p className="text-sm font-semibold text-emerald-700">Message sent on this contract.</p> : null}

        {canSignNative ? (
          <section
            id="sign"
            className="rounded-2xl border-2 border-violet bg-[#F4F0FF] p-5 shadow-[0_8px_24px_rgba(88,70,200,0.12)]"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet">Action required</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-indigo">Sign this agreement</h2>
            <p className="mt-2 text-sm text-indigo">
              You are listed as <strong>{party?.role}</strong> ({party?.email}). Type your legal name — Influrios
              converts it into a handwritten signature and page-endorsement initials on every page of the PDF.
            </p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted">
              <li>Review the parties and agreement text below</li>
              <li>Type your legal name exactly as you intend to sign — watch the live signature preview</li>
              <li>Confirm and submit — ink + initials are stamped on every contract page</li>
            </ol>
            <form action={actionSignNativeContract} className="mt-5 space-y-3 rounded-xl bg-white p-4">
              <input type="hidden" name="documentId" value={document.id} />
              <SignaturePad name="typedName" defaultValue={party?.name ?? ""} required minLength={2} maxLength={160} />
              <label className="flex items-start gap-2 text-sm text-indigo">
                <input type="checkbox" name="agree" value="1" required className="mt-0.5 accent-violet" />
                <span>
                  I agree to the terms of this agreement and intend this typed name to be my electronic signature for{" "}
                  {document.title}, including page endorsements on each page of the PDF.
                </span>
              </label>
              <button type="submit" className="btn-primary w-full !py-3 text-base sm:w-auto">
                Sign agreement now
              </button>
            </form>
          </section>
        ) : null}

        {!isNative && awaitingSignature && party && party.status === "pending" ? (
          <section className="rounded-2xl border-2 border-violet bg-[#F4F0FF] p-5">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet">Action required</p>
            <h2 className="mt-1 font-display text-xl font-bold text-indigo">Sign in DocuSign</h2>
            <p className="mt-2 text-sm text-indigo">
              This agreement was sent through DocuSign. Check your email ({party.email}) for the envelope, then return
              here to track status.
            </p>
          </section>
        ) : null}

        {party && isNative && youSigned && document.status !== "signed" ? (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            You signed this agreement{party.signedAt ? ` on ${party.signedAt.toISOString().slice(0, 10)}` : ""}. Still
            waiting on: {pendingParties.map((row) => row.name).join(", ") || "other parties"}.
          </p>
        ) : null}

        <section className="rounded-2xl border border-[#E4E9F5] bg-white p-5">
          <h2 className="font-display text-xl font-bold text-indigo">Signature checklist</h2>
          <p className="mt-1 text-sm text-muted">Every party below must sign before funding can start.</p>
          <ul className="mt-4 space-y-3">
            {document.parties.map((row) => {
              const isYou = party?.id === row.id;
              const waiting = row.status === "pending" && awaitingSignature;
              return (
                <li
                  key={row.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-3 text-sm ${
                    waiting ? "bg-[#F4F0FF] ring-1 ring-violet/30" : "bg-[#F4F7FF]"
                  }`}
                >
                  <span className="text-indigo">
                    <span className="font-semibold">
                      {row.name}
                      {isYou ? " (you)" : ""}
                    </span>
                    <span className="text-muted">
                      {" "}
                      · {row.role} · {row.email}
                      {row.shareBps ? ` · ${(row.shareBps / 100).toFixed(2)}%` : ""}
                    </span>
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                      row.status === "signed"
                        ? "bg-emerald-100 text-emerald-800"
                        : row.status === "declined"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-violet/15 text-violet"
                    }`}
                  >
                    {row.status === "signed"
                      ? row.attestation
                        ? `Signed as “${row.attestation}”`
                        : "Signed"
                      : row.status === "declined"
                        ? "Declined"
                        : isYou && canSignNative
                          ? "Your turn — sign above"
                          : "Awaiting signature"}
                  </span>
                </li>
              );
            })}
          </ul>
          {canSignNative ? (
            <p className="mt-4 text-sm font-semibold text-violet">
              <a href="#sign" className="hover:underline">
                Jump to sign form ↑
              </a>
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-[#E4E9F5] bg-white p-5 shadow-[0_10px_30px_rgba(40,50,100,0.06)]">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[#E4E9F5] pb-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet">
                Influrios · Collaboration agreement
              </p>
              <h2 className="mt-1 font-display text-xl font-bold text-indigo">Agreement</h2>
            </div>
            <p className="text-xs text-muted">ID {document.id.slice(0, 12)}…</p>
          </div>
          <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-indigo">{agreementBody}</pre>
        </section>

        <section className="rounded-2xl border border-[#E4E9F5] bg-white p-5">
          <h2 className="font-display text-xl font-bold text-indigo">Messages</h2>
          <p className="mt-1 text-sm text-muted">
            <strong className="text-indigo">All parties</strong> emails every business and influencer on this contract.{" "}
            <strong className="text-indigo">One party</strong> goes only to the person you select.
          </p>
          {messages.length === 0 ? <p className="mt-3 text-sm text-muted">No messages you can read yet.</p> : null}
          <ul className="mt-3 space-y-3">
            {messages.map((message) => (
              <li key={message.id} className="rounded-xl bg-[#F4F7FF] px-3 py-2 text-sm">
                <p className="font-semibold text-indigo">
                  {message.senderName} · {message.audience.replaceAll("_", " ")}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-indigo">{message.body}</p>
              </li>
            ))}
          </ul>
          {canMessage ? (
            <form action={actionPostContractMessage} className="mt-4 space-y-3">
              <input type="hidden" name="documentId" value={document.id} />
              <label className="block text-sm font-semibold text-indigo">
                Who can read this
                <select
                  name="audience"
                  defaultValue="all_parties"
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
                >
                  <option value="all_parties">All parties (business + every influencer)</option>
                  <option value="party">One party only</option>
                  <option value="admin">Admin only</option>
                  <option value="contract_manager">Contract manager only</option>
                </select>
              </label>
              <label className="block text-sm font-semibold text-indigo">
                Party (required when you chose one party)
                <select name="recipientPartyId" className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal">
                  <option value="">Select a party</option>
                  {document.parties.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name} · {row.role}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-indigo">
                Message
                <textarea
                  name="body"
                  required
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
                />
              </label>
              <button type="submit" className="btn-primary !py-2 text-sm">
                Send on this contract
              </button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-muted">You can read this agreement. Messaging is not open for this access level.</p>
          )}
        </section>
      </div>
    </div>
  );
}
