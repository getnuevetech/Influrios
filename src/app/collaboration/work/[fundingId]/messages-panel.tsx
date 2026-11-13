import { actionPostContractMessage } from "@/app/collaboration/contracts/[id]/actions";
import { getAccountSession } from "@/lib/accounts";
import { getAdminSession } from "@/lib/admin-auth";
import { adminCanOpenContractMessages, messageVisible, resolveContractPartyForAccount } from "@/lib/contract-document";
import { prisma } from "@/lib/db";

export async function WorkspaceMessages({ fundingId }: { fundingId: string }) {
  const [account, admin, document] = await Promise.all([
    getAccountSession().catch(() => null),
    getAdminSession().catch(() => null),
    prisma.contractDocument.findFirst({
      where: { fundingId },
      orderBy: { updatedAt: "desc" },
      include: {
        parties: { orderBy: { createdAt: "asc" } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    }).catch(() => null),
  ]);
  if (!document) {
    return (
      <section id="messages" className="rounded-2xl border border-border bg-white p-5">
        <h2 className="font-display text-xl font-bold text-indigo">Messages</h2>
        <p className="mt-2 text-sm text-muted">Discussion opens when this collaboration has an agreement. Deliverables stay on this page.</p>
      </section>
    );
  }
  const party = account ? resolveContractPartyForAccount(document.parties, account) : undefined;
  const viewer = party && account
    ? ({ kind: "party" as const, userId: account.id, partyId: party.id })
    : admin
      ? ({ kind: "admin" as const, userId: admin.userId, roleId: admin.roleId, permissions: admin.permissions })
      : null;
  const messages = viewer
    ? document.messages.filter((message) => messageVisible({
        audience: message.audience,
        recipientPartyId: message.recipientPartyId,
        senderUserId: message.senderUserId,
        senderAdminId: message.senderAdminId,
        viewer,
      }))
    : [];
  const canMessage = Boolean(party || (admin && adminCanOpenContractMessages(admin)));
  const returnTo = `/collaboration/work/${fundingId}?tab=messages`;
  return (
    <section id="messages" className="rounded-2xl border border-border bg-white p-5">
      <h2 className="font-display text-xl font-bold text-indigo">Messages</h2>
      <p className="mt-1 text-sm text-muted">This is the conversation for the agreement. Deliverables stay on this page. A message does not fund, release, or refund.</p>
      {messages.length === 0 ? <p className="mt-3 text-sm text-muted">No messages you can read yet.</p> : (
        <ul className="mt-3 space-y-3">
          {messages.map((message) => (
            <li key={message.id} className="rounded-xl bg-[#F4F7FF] px-3 py-2 text-sm">
              <p className="font-semibold text-indigo">{message.senderName} · {message.audience.replaceAll("_", " ")} · {message.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</p>
              <p className="mt-1 whitespace-pre-wrap text-indigo">{message.body}</p>
            </li>
          ))}
        </ul>
      )}
      {canMessage ? (
        <form action={actionPostContractMessage} className="mt-4 space-y-3">
          <input type="hidden" name="documentId" value={document.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <label className="block text-sm font-semibold text-indigo">
            Who can read this
            <select name="audience" defaultValue="all_parties" className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal">
              <option value="all_parties">All parties</option>
              <option value="party">One party only</option>
            </select>
          </label>
          <label className="block text-sm font-semibold text-indigo">
            Party, when you chose one party
            <select name="recipientPartyId" className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal">
              <option value="">Select a party</option>
              {document.parties.map((row) => (
                <option key={row.id} value={row.id}>{row.name} · {row.role}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-indigo">
            Message
            <textarea name="body" required minLength={1} rows={4} className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal" />
          </label>
          <button type="submit" className="inline-flex h-11 items-center rounded-full bg-violet px-4 text-sm font-semibold text-white">Send message</button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-muted">You can read the conversation. Sending stays with a party on the agreement.</p>
      )}
    </section>
  );
}
