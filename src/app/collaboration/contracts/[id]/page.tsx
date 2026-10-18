import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { actionPostContractMessage, actionSignNativeContract } from "@/app/collaboration/contracts/[id]/actions";
import { getAccountSession } from "@/lib/accounts";
import { getAdminSession } from "@/lib/admin-auth";
import {
  adminCanOpenContractMessages,
  messageVisible,
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
  // Heal stale party userId so later list/sign lookups stay consistent.
  if (party && account && party.userId !== account.id) {
    await prisma.contractParty.update({ where: { id: party.id }, data: { userId: account.id } }).catch(() => undefined);
    party = { ...party, userId: account.id };
  }
  const adminOpen = admin
    ? adminCanOpenContractMessages(admin) || admin.permissions.includes("contracts.manage") || admin.permissions.includes("contracts.view")
    : false;
  if (!party && !adminOpen) redirect("/login?next=/collaboration/contracts/" + id);

  // Prefer party viewer whenever the account matches a party (never demote to admin).
  const viewer = party && account
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
  const source = document.sourceJson && typeof document.sourceJson === "object" ? (document.sourceJson as Record<string, string>) : {};
  const returnQuery = new URLSearchParams({ ...source, contractDocument: document.id });
  const isNative = document.signingChannel === "native";
  const canSignNative = Boolean(party && isNative && document.status === "sent" && party.status === "pending");
  const channelLabel = isNative
    ? "Influrios in-app"
    : document.envelopeId
      ? `DocuSign ${document.envelopeId}`
      : "DocuSign";

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
          </p>
          <p className="mt-2 text-sm text-muted">
            {isNative
              ? "Each party signs in Influrios by typing their legal name below. The agreement is signed when every party has completed their signature. The PDF is stored on each party's account."
              : "This agreement was sent through DocuSign. It is signed when DocuSign reports every party complete. The PDF is stored on each party's account."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
            <Link href={`/collaboration/contracts/${document.id}/pdf`} className="text-violet hover:underline">
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
          <p className="text-sm font-semibold text-emerald-700">Every party has signed. Funding can start.</p>
        ) : null}
        {query.signed === "0" ? (
          <p className="text-sm font-semibold text-emerald-700">Your signature was recorded. Waiting for the other parties.</p>
        ) : null}
        {query.sent ? <p className="text-sm font-semibold text-emerald-700">Message saved on this contract.</p> : null}
        {canSignNative ? (
          <section className="rounded-2xl border border-[#E4E9F5] bg-white p-5">
            <h2 className="font-display text-xl font-bold text-indigo">Sign this agreement</h2>
            <p className="mt-1 text-sm text-muted">
              Type your legal name exactly as you intend to bind this agreement. This records your signature on the
              stored PDF.
            </p>
            <form action={actionSignNativeContract} className="mt-4 space-y-3">
              <input type="hidden" name="documentId" value={document.id} />
              <label className="block text-sm font-semibold text-indigo">
                Legal name
                <input
                  name="typedName"
                  required
                  minLength={2}
                  maxLength={160}
                  defaultValue={party?.name ?? ""}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
                />
              </label>
              <label className="flex items-start gap-2 text-sm text-indigo">
                <input type="checkbox" name="agree" value="1" required className="mt-0.5 accent-violet" />
                <span>
                  I agree to the terms of this agreement and intend this typed name to be my electronic signature.
                </span>
              </label>
              <button type="submit" className="btn-primary !py-2 text-sm">
                Sign agreement
              </button>
            </form>
          </section>
        ) : null}
        {party && isNative && party.status === "signed" && document.status !== "signed" ? (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            You signed this agreement{party.signedAt ? ` on ${party.signedAt.toISOString()}` : ""}. Waiting for the
            other parties.
          </p>
        ) : null}
        <section className="rounded-2xl border border-[#E4E9F5] bg-white p-5">
          <h2 className="font-display text-xl font-bold text-indigo">Parties</h2>
          <ul className="mt-3 space-y-2 text-sm text-indigo">
            {document.parties.map((row) => (
              <li key={row.id}>
                {row.role} · {row.name} · {row.email} · {row.status}
                {row.attestation ? ` · signed as “${row.attestation}”` : ""}
                {row.shareBps ? ` · ${(row.shareBps / 100).toFixed(2)}%` : ""}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-[#E4E9F5] bg-white p-5">
          <h2 className="font-display text-xl font-bold text-indigo">Agreement</h2>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-indigo">{document.renderedBody}</pre>
        </section>
        <section className="rounded-2xl border border-[#E4E9F5] bg-white p-5">
          <h2 className="font-display text-xl font-bold text-indigo">Messages</h2>
          <p className="mt-1 text-sm text-muted">
            <strong className="text-indigo">All parties</strong> is visible to every business and influencer on this
            contract (and emails them). <strong className="text-indigo">One party</strong> goes only to the person you
            select. Admin / contract manager stay with staff. Super Admin can read every message; other admins need the
            contract-messages grant (managers also see all-parties threads).
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
                <select name="audience" defaultValue="all_parties" className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal">
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
                <textarea name="body" required rows={4} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
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
