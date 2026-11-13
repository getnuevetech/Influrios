import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { actionAddDeliverableFiles, actionSubmitMilestone } from "@/app/payments/actions";
import { getAccountSession } from "@/lib/accounts";
import { assertFundingAccess } from "@/lib/funding-access";
import { VersionReview } from "@/components/version-review";
import { milestoneWorkLabel, visibleSubmissions } from "@/lib/milestone-delivery";
import { memberDealView } from "@/lib/member-deal-money";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deliverables" };

type Props = {
  params: Promise<{ fundingId: string }>;
  searchParams: Promise<{ error?: string; submitted?: string; revised?: string; approved?: string; version?: string }>;
};

export default async function CollaborationWorkPage({ params, searchParams }: Props) {
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect("/login?next=/collaboration/hub");
  const { fundingId } = await params;
  const query = await searchParams;
  const access = await assertFundingAccess(account, fundingId);
  if (!access.ok) notFound();
  const funding = await prisma.collaborationFunding.findUnique({
    where: { id: access.funding.id },
    include: {
      milestones: {
        orderBy: { sortOrder: "asc" },
        include: {
          submissions: { orderBy: { version: "asc" }, include: { files: { orderBy: { createdAt: "asc" } } } },
          files: { orderBy: { createdAt: "asc" } },
        },
      },
      disputes: { where: { status: { in: ["open", "under_review", "refund_requested"] } } },
    },
  });
  if (!funding) notFound();
  const contract = await prisma.contractDocument
    .findFirst({ where: { fundingId: funding.id }, select: { id: true, title: true } })
    .catch(() => null);
  const business = access.audience === "business";
  const money = memberDealView({
    role: business ? "business" : "influencer",
    grossCents: funding.grossCents,
    feeCents: funding.feeCents,
    plan: funding.feeSnapshotJson,
  });

  const funded = funding.status === "held" || funding.status === "completed";
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="flex flex-wrap gap-4">
          <Link href="/payments" className="text-sm font-semibold text-violet hover:underline">
            ← Payments
          </Link>
          {contract ? (
            <Link href={`/collaboration/contracts/${contract.id}`} className="text-sm font-semibold text-violet hover:underline">
              Agreement
            </Link>
          ) : null}
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-indigo">{funding.title}</h1>
          <p className="mt-2 text-sm font-semibold text-[#6D4AFF]">{funded ? "Funded" : "Waiting for funding"}</p>
          <p className="mt-1 text-xs text-[#667085]">
            {business ? "Next actor: business reviews a submitted version." : "Next actor: influencer submits the next version."}
          </p>
        </div>
        <ol className="space-y-2">
          {funding.milestones.map((milestone, index) => (
            <li key={milestone.id} className="rounded-2xl border border-[#E7ECF5] bg-white px-3 py-2 text-sm">
              <p className="font-semibold text-[#1B1464]">{index + 1}. {milestone.title}</p>
              <p className="text-xs text-[#667085]">{milestoneWorkLabel(milestone.status)}</p>
            </li>
          ))}
        </ol>
        <p className="text-xs text-[#98A2B3]">Approval and payout are separate statuses. A failed payout does not undo an approved version.</p>
      </aside>
      <div className="space-y-6">
      <div>
        <p className="mt-2 text-sm text-muted">
          {funding.businessName} · {funding.status.replaceAll("_", " ")}
          {money.lines.map((line) => ` · ${line.label} ${formatMoney(line.amountCents, funding.currency)}`).join("")}
        </p>
        <p className="mt-2 text-sm text-indigo">
          {funding.status !== "held" && funding.status !== "completed"
            ? "Deliverables open after the deposit is confirmed."
            : business
              ? "Review the exact version an influencer submitted. A revision keeps the earlier versions."
              : "Submit a link or a note for your deliverable. The review clock starts when the version is saved."}
        </p>
      </div>
      {query.submitted ? <p className="text-sm font-semibold text-emerald-700">Version submitted.</p> : null}
      {query.revised ? <p className="text-sm font-semibold text-emerald-700">Revision requested on the latest version.</p> : null}
      {query.approved ? <p className="text-sm font-semibold text-emerald-700">That version was approved. Payout confirmation stays separate.</p> : null}
      {query.error ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{query.error}</p> : null}

      {funding.milestones.map((milestone) => {
        const rows = visibleSubmissions(milestone.submissions, access.audience, access.actorSlug);
        const openDispute = funding.disputes.find((row) => row.milestoneId === milestone.id || row.milestoneId == null);
        return (
          <section key={milestone.id} className="rounded-2xl border border-[#E4EBFF] bg-white p-5">
            <h2 className="font-display text-xl font-bold text-indigo">{milestone.title}</h2>
            <p className="mt-1 text-sm text-muted">
              {formatMoney(milestone.amountCents, funding.currency)} · {milestoneWorkLabel(milestone.status)}
              {milestone.deliverableDueAt ? ` · deliver by ${milestone.deliverableDueAt.toISOString().slice(0, 10)}` : ""}
              {milestone.autoApproveAt && milestone.status === "submitted"
                ? ` · review by ${milestone.autoApproveAt.toISOString().slice(0, 16).replace("T", " ")} UTC`
                : milestone.reviewWindowHours
                  ? ` · ${milestone.reviewWindowHours}h review window`
                  : ""}
              {milestone.releaseScheduledAt ? ` · release scheduled ${milestone.releaseScheduledAt.toISOString().slice(0, 16).replace("T", " ")} UTC` : ""}
              {milestone.status === "released" ? " · payout confirmed" : ""}
            </p>
            {openDispute ? (
              <p className="mt-2 text-sm text-amber-800">
                A dispute holds {formatMoney(milestone.amountCents, funding.currency)} on this milestone.
              </p>
            ) : null}
            <VersionReview
              dealId={funding.id}
              milestoneId={milestone.id}
              business={business}
              revisionCount={milestone.revisionCount}
              revisionLimit={milestone.revisionLimit}
              reviewBy={
                milestone.autoApproveAt && milestone.status === "submitted"
                  ? `${milestone.autoApproveAt.toISOString().slice(0, 16).replace("T", " ")} UTC`
                  : null
              }
              initialVersion={Number(query.version) || undefined}
              versions={rows.map((row) => ({
                id: row.id,
                version: row.version,
                status: row.status,
                note: row.note,
                linkUrl: row.linkUrl,
                reviewNote: row.reviewNote,
                creatorSlug: row.creatorSlug,
                files: row.files.map((file) => ({ id: file.id, fileName: file.fileName })),
              }))}
            />
            {milestone.files.some((file) => !file.submissionId) ? (
              <ul className="mt-3 space-y-1 text-sm">
                {milestone.files
                  .filter((file) => !file.submissionId)
                  .map((file) => (
                    <li key={file.id}>
                      <a href={`/api/deliverables/${file.id}`} className="font-semibold text-violet hover:underline">
                        {file.fileName}
                      </a>
                      <span className="text-xs text-muted"> · {file.kind} · {file.audience}</span>
                    </li>
                  ))}
              </ul>
            ) : null}
            {!business && funding.status === "held" && milestone.status === "pending" ? (
              <form action={actionSubmitMilestone} className="mt-4 space-y-2">
                <input type="hidden" name="dealId" value={funding.id} />
                <input type="hidden" name="milestoneId" value={milestone.id} />
                <input name="linkUrl" placeholder="https:// link to the work" className="w-full rounded-xl border border-border px-3 py-2 text-sm" />
                <textarea name="note" rows={3} placeholder="What this version includes" className="w-full rounded-xl border border-border px-3 py-2 text-sm" />
                <DeliverableFileField />
                <button type="submit" className="btn-primary !py-2 text-sm">
                  Submit this version
                </button>
              </form>
            ) : null}
            {business && funding.status === "held" ? (
              <form action={actionAddDeliverableFiles} className="mt-4 space-y-2">
                <input type="hidden" name="dealId" value={funding.id} />
                <input type="hidden" name="milestoneId" value={milestone.id} />
                <DeliverableFileField />
                <button type="submit" className="btn-secondary !py-2 text-sm">
                  Add files
                </button>
              </form>
            ) : null}
          </section>
        );
      })}
      </div>
    </div>
  );
}

function DeliverableFileField() {
  return (
    <label className="block text-xs font-semibold text-muted">
      Documents, media, or files
      <input
        name="files"
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov,.mp3,.wav,.m4a,.zip"
        className="mt-1 block w-full text-sm font-normal text-indigo"
      />
      <span className="mt-1 block font-normal">Up to 4 files, 8 MB each. Documents, photos, video, audio, or a zip.</span>
    </label>
  );
}
