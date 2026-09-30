import Link from "next/link";
import { listCollaborations } from "@/lib/collaborations";
import { getCreatorBySlug } from "@/lib/seed-data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Collaboration proposals" };

type Props = { searchParams: Promise<{ from?: string }> };

export default async function CollaborationRecordsPage({ searchParams }: Props) {
  const params = await searchParams;
  let records: Awaited<ReturnType<typeof listCollaborations>> = [];
  let dbError = false;
  try {
    records = await listCollaborations({ slug: params.from });
  } catch (error) {
    console.error("collaboration list", error);
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link href="/collaboration" className="text-sm font-semibold text-violet">
        ← Matches
      </Link>
      <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Proposals</h1>
      <p className="mt-2 text-sm text-muted">
        Drafts stay here until they are sent. Accepted proposals stay on this list after a refresh.
      </p>
      {dbError ? (
        <p className="mt-4 text-sm font-semibold text-amber-800">The database is unavailable, so proposals cannot be loaded.</p>
      ) : null}
      {!dbError && records.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No proposals yet.</p>
      ) : null}
      <ul className="mt-6 space-y-3">
        {records.map((record) => {
          const initiator = getCreatorBySlug(record.initiatorSlug);
          const recipient = getCreatorBySlug(record.recipientSlug);
          return (
            <li key={record.id}>
              <Link href={`/collaboration/records/${record.id}`} className="card-surface block p-4 hover:border-violet">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet">{record.status}</p>
                <p className="mt-1 font-semibold text-indigo">{record.title}</p>
                <p className="mt-1 text-sm text-muted">
                  {initiator?.displayName ?? record.initiatorSlug} → {recipient?.displayName ?? record.recipientSlug}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
