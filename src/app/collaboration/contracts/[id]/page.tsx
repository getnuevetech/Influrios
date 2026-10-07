import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { actionPostContractMessage } from "@/app/collaboration/contracts/[id]/actions";
import { getAccountSession } from "@/lib/accounts";
import { getAdminSession } from "@/lib/admin-auth";
import { adminCanOpenContractMessages, messageVisible } from "@/lib/contract-document";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; sent?: string }>;
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
  const party = account ? document.parties.find((row) => row.userId === account.id) : undefined;
  const adminOpen = admin
    ? adminCanOpenContractMessages(admin) || admin.permissions.includes("contracts.manage") || admin.permissions.includes("contracts.view")
    : false;
  if (!party && !adminOpen) redirect("/login?next=/collaboration/contracts/" + id);

  const viewer = party
    ? ({ kind: "party", userId: account!.id, partyId: party.id } as const)
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

  return (
    <div className="bg-[#F7FAFF]">
      <section className="border-b border-[#E4E9F5] bg-white">
        <div className="mx-auto max-w-3xl px-4 py-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet">Contract</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-indigo">{document.title}</h1>
          <p className="mt-2 text-sm text-muted">
            Status: <strong className="text-indigo">{document.status}</strong>
            {document.envelopeId ? ` · DocuSign ${document.envelopeId}` : ""}
          </p>
          <p className="mt-2 text-sm text-muted">
            This agreement is signed when DocuSign reports every party complete. A click in Influrios does not sign it.
            The PDF is stored on each party&apos;s account.
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
        {query.sent ? <p className="text-sm font-semibold text-emerald-700">Message saved on this contract.</p> : null}
        <section className="rounded-2xl border border-[#E4E9F5] bg-white p-5">
          <h2 className="font-display text-xl font-bold text-indigo">Parties</h2>
          <ul className="mt-3 space-y-2 text-sm text-indigo">
            {document.parties.map((row) => (
              <li key={row.id}>
                {row.role} · {row.name} · {row.email} · {row.status}
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
            Choose one party, every party, an admin, or the contract manager. Super Admin can read every message.
            Another admin can read them only after Super Admin grants contract messages on that access level.
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
                <select name="audience" className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal">
                  <option value="all_parties">All parties</option>
                  <option value="party">One party</option>
                  <option value="admin">Admin</option>
                  <option value="contract_manager">Contract manager</option>
                </select>
              </label>
              <label className="block text-sm font-semibold text-indigo">
                Party, when you chose one party
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
                Save on this contract
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
