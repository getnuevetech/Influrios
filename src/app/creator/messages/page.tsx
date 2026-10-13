import Link from "next/link";
import { redirect } from "next/navigation";
import { Panel } from "@/components/dashboard-ui";
import { IconMail } from "@/components/icons";
import { getAccountSession } from "@/lib/accounts";
import { loadCreatorHub } from "@/lib/collaboration-hub";
import { draftToSeedCreator, getCreatorSessionDraft } from "@/lib/claim";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages" };

export default async function CreatorMessagesPage() {
  const account = await getAccountSession();
  if (!account) redirect("/login?next=/creator/messages");

  const [creator, draft] = await Promise.all([
    prisma.creator.findUnique({ where: { userId: account.id }, select: { slug: true } }).catch(() => null),
    getCreatorSessionDraft().catch(() => null),
  ]);
  const seed = draft ? draftToSeedCreator(draft) : null;
  const hub =
    creator && seed
      ? await loadCreatorHub({ userId: account.id, creator: seed }).catch(() => null)
      : null;
  const pipeline = hub?.pipeline ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/creator" className="text-sm font-semibold text-violet hover:underline">
          ← Creator account
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">Messages</h1>
        <p className="mt-1 text-sm text-muted">
          Brand conversations stay with your collaboration contracts and opportunities. A general inbox is not stored
          yet — open an active deal to continue the thread.
        </p>
      </div>

      <Panel title="Collaboration threads">
        {pipeline.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-[#C9D3EA] bg-[#F7F8FC] p-6">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1ECFF] text-violet">
              <IconMail size={22} />
            </span>
            <div>
              <p className="font-semibold text-indigo">No active message threads yet</p>
              <p className="mt-1 text-sm text-muted">
                When brands invite you or you accept a collaboration, messaging opens from that deal — not a separate
                mailbox of invented chats.
              </p>
            </div>
            <Link href="/collaboration/hub?view=opportunities" className="btn-primary !py-2 text-sm">
              View opportunities
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {pipeline.slice(0, 8).map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href || "/collaboration/hub?view=collaborations#pipeline"}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#F0F3FA] px-4 py-3 hover:bg-[#F7F8FC]"
                >
                  <span>
                    <span className="block text-sm font-semibold">{item.title}</span>
                    <span className="text-xs text-muted">
                      {item.counterparty} · {item.stage}
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-violet">Open →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
