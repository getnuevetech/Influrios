import Link from "next/link";
import { notFound } from "next/navigation";
import { actionAdvanceCollaboration, actionQueueSignature } from "@/app/collaboration/records/actions";
import { getAccountSession } from "@/lib/accounts";
import { COLLABORATION_STATUSES, getCollaboration, reasonList, type CollaborationStatus } from "@/lib/collaborations";
import { prisma } from "@/lib/db";
import { activeSigningProvider } from "@/lib/providers";
import { getDirectoryCreator } from "@/lib/directory";
import { specialtyLabel } from "@/lib/seed-data";

export const dynamic = "force-dynamic";

const NEXT_ACTIONS: Record<CollaborationStatus, { to: CollaborationStatus; label: string; tone: "primary" | "secondary" }[]> = {
  draft: [
    { to: "sent", label: "Send proposal", tone: "primary" },
    { to: "withdrawn", label: "Withdraw", tone: "secondary" },
  ],
  sent: [
    { to: "accepted", label: "Accept", tone: "primary" },
    { to: "declined", label: "Decline", tone: "secondary" },
    { to: "withdrawn", label: "Withdraw", tone: "secondary" },
  ],
  accepted: [],
  declined: [],
  withdrawn: [],
};

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> };

export default async function CollaborationRecordPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  let record: Awaited<ReturnType<typeof getCollaboration>> = null;
  try {
    record = await getCollaboration(id);
  } catch (error) {
    console.error("collaboration record", error);
  }
  if (!record) notFound();

  const account = await getAccountSession();
  const initiator = await getDirectoryCreator(record.initiatorSlug);
  const recipient = await getDirectoryCreator(record.recipientSlug);
  const reasons = reasonList(record.reasons);
  const status = (COLLABORATION_STATUSES as readonly string[]).includes(record.status)
    ? (record.status as CollaborationStatus)
    : "draft";
  const actions = NEXT_ACTIONS[status];
  const signing = await activeSigningProvider().catch(() => null);
  const signatures = await prisma.signatureRequest
    .findMany({ where: { collaborationId: record.id }, orderBy: { createdAt: "desc" }, include: { provider: true } })
    .catch(() => []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Link href={`/collaboration/records?from=${record.initiatorSlug}`} className="text-sm font-semibold text-violet">
        ← Proposals
      </Link>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-violet">{status}</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-indigo">{record.title}</h1>
      <p className="mt-2 text-muted">
        {initiator?.displayName ?? record.initiatorSlug} → {recipient?.displayName ?? record.recipientSlug}
        {record.score ? ` · ${record.score}% match` : ""}
      </p>

      {query.error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{query.error}</p>
      ) : null}

      {record.why.trim() || reasons.length ? (
        <section id="why-this-match" className="mt-6 rounded-2xl bg-lavender/40 p-4">
          <h2 className="font-semibold text-indigo">Why this match</h2>
          {record.why.trim() ? <p className="mt-2 text-sm text-indigo">{record.why}</p> : null}
          {reasons.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <dl className="card-surface mt-6 space-y-3 p-6 text-sm">
        <div>
          <dt className="font-semibold text-indigo">Scope</dt>
          <dd className="mt-1 text-muted">{record.scope}</dd>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-indigo">Your role</dt>
            <dd className="mt-1 text-muted">{record.roleInitiator}</dd>
          </div>
          <div>
            <dt className="font-semibold text-indigo">Their role</dt>
            <dd className="mt-1 text-muted">{record.roleRecipient}</dd>
          </div>
        </div>
        <div>
          <dt className="font-semibold text-indigo">Commercial framing</dt>
          <dd className="mt-1 text-muted">{record.commercial}</dd>
        </div>
        {record.offerSpecialty || record.needSpecialty ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {record.offerSpecialty ? (
              <div>
                <dt className="font-semibold text-indigo">Offer specialty</dt>
                <dd className="mt-1 text-muted">{specialtyLabel(record.offerSpecialty)}</dd>
              </div>
            ) : null}
            {record.needSpecialty ? (
              <div>
                <dt className="font-semibold text-indigo">Need specialty</dt>
                <dd className="mt-1 text-muted">{specialtyLabel(record.needSpecialty)}</dd>
              </div>
            ) : null}
          </div>
        ) : null}
      </dl>

      {account && actions.length ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {actions.map((action) => (
            <form key={action.to} action={actionAdvanceCollaboration}>
              <input type="hidden" name="id" value={record.id} />
              <input type="hidden" name="to" value={action.to} />
              <button type="submit" className={action.tone === "primary" ? "btn-primary" : "btn-secondary"}>
                {action.label}
              </button>
            </form>
          ))}
        </div>
      ) : null}

      {account && status === "accepted" ? (
        <p className="mt-6">
          <Link
            href={`/collaboration/contract?collaboration=${encodeURIComponent(record.id)}&creator=${encodeURIComponent(record.recipientSlug)}&title=${encodeURIComponent(record.title)}&scope=${encodeURIComponent(record.scope.slice(0, 200))}&commercial=${encodeURIComponent(record.commercial)}`}
            className="btn-primary"
          >
            Open contract & fund
          </Link>
        </p>
      ) : null}
      <section className="card-surface mt-6 p-6 text-sm">
        <h2 className="font-semibold text-indigo">Document signing</h2>
        <p className="mt-2 text-muted">
          {signing?.enabled && signing.hasSecret
            ? `Connected to ${signing.name}. A request stays queued until that provider confirms the signature.`
            : "Document signing is not connected. An admin adds the API details under Document signing."}
        </p>
        {signatures.length ? (
          <ul className="mt-3 space-y-1 text-muted">
            {signatures.map((request) => (
              <li key={request.id}>
                {request.status} · {request.provider?.name ?? "Unassigned"} · {request.title}
              </li>
            ))}
          </ul>
        ) : null}
        {account && status === "accepted" && signing?.enabled && signing.hasSecret ? (
          <form action={actionQueueSignature} className="mt-4">
            <input type="hidden" name="id" value={record.id} />
            <button type="submit" className="btn-primary">
              Queue signature request
            </button>
          </form>
        ) : null}
      </section>

      {!account && actions.length ? (
        <p className="mt-6 text-sm text-muted">
          <Link
            href={`/login?next=${encodeURIComponent(`/collaboration/records/${record.id}`)}&gate=proposal`}
            className="font-semibold text-violet"
          >
            Sign in
          </Link>{" "}
          to send, accept, or decline this proposal.
        </p>
      ) : null}
    </div>
  );
}
