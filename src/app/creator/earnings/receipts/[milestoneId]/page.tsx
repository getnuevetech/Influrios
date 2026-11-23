import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { milestonePayoutFacts } from "@/lib/collab-email-links";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payout receipt" };

type Props = { params: Promise<{ milestoneId: string }> };

const money = (cents: number | null, currency: string) =>
  cents == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

const when = (date: Date | null) =>
  date
    ? `${new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", dateStyle: "long", timeStyle: "short" }).format(date)} CT`
    : "—";

/** One milestone's payout: what the agreement set, what was deducted, what was sent and where. */
export default async function PayoutReceiptPage({ params }: Props) {
  const { milestoneId } = await params;
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect(`/login?next=${encodeURIComponent(`/creator/earnings/receipts/${milestoneId}`)}`);
  const facts = await milestonePayoutFacts(milestoneId);
  if (!facts) notFound();
  // Only the influencer on this collaboration sees its receipt.
  const own = await prisma.creator.findFirst({ where: { slug: facts.creatorSlug, userId: account.id }, select: { id: true } });
  if (!own) notFound();

  const paid = facts.paidCents > 0;
  const rows: [string, string][] = [
    ["Collaboration", facts.collaboration],
    ["Business", facts.business],
    ["Milestone", facts.title],
    ["Gross milestone compensation", money(facts.grossCents, facts.currency)],
    ["Your collaboration fee", facts.influencerFeeCents == null ? "—" : `− ${money(facts.influencerFeeCents, facts.currency)}`],
    ["Withholding and approved deductions", facts.withheldCents ? `− ${money(facts.withheldCents, facts.currency)}` : money(0, facts.currency)],
    ["Net payout", money(facts.netCents, facts.currency)],
    ["Sent to", facts.destination || "Your payout account on file"],
    [paid ? "Paid on" : "Approved on", paid ? when(facts.paidAt) : when(facts.approvedAt)],
    ["Payment reference", facts.transferRef || "—"],
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-8">
      <Link href="/creator/earnings" className="text-sm font-semibold text-violet">
        Back to earnings
      </Link>
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-violet">Payout receipt</p>
        <h1 className="font-display text-3xl font-bold text-indigo">{facts.title}</h1>
        <p className="mt-2 inline-flex rounded-full bg-[#EAF7EF] px-3 py-1 text-sm font-semibold text-[#146C3A]">
          {paid ? "Paid" : facts.status === "release_scheduled" || facts.status === "release_requested" ? "Payout processing" : "Not paid yet"}
        </p>
      </div>
      <section className="rounded-2xl border border-border bg-white p-5">
        <dl className="divide-y divide-[#EEEFF5] text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className={`flex justify-between gap-4 py-2.5 ${label === "Net payout" ? "font-bold" : ""}`}>
              <dt className="text-muted">{label}</dt>
              <dd className="text-right text-indigo">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <p className="text-xs text-muted">
        {paid
          ? "The payout was sent to your Stripe payout account. Stripe moves it to your bank on your payout schedule; you can see that in your Stripe account."
          : "This milestone has not been paid yet. This page updates when the payout is sent."}
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href={`/collaboration/work/${facts.fundingId}`} className="inline-flex h-11 items-center rounded-full bg-violet px-4 text-sm font-semibold text-white">
          Open the collaboration
        </Link>
        <Link
          href={`/support?topic=${encodeURIComponent("Payments and payouts")}&ref=${encodeURIComponent(facts.transferRef || `Payout ${facts.title}`)}`}
          className="inline-flex h-11 items-center rounded-full border border-border px-4 text-sm font-semibold text-indigo"
        >
          Contact support
        </Link>
      </div>
    </div>
  );
}
