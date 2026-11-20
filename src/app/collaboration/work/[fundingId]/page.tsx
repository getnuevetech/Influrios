import { notFound, redirect } from "next/navigation";
import { WorkspacePanel } from "@/app/collaboration/work/[fundingId]/workspace-panel";
import { getAccountSession } from "@/lib/accounts";
import { assertFundingAccess } from "@/lib/funding-access";
import { memberDealView } from "@/lib/member-deal-money";
import { visibleSubmissions } from "@/lib/milestone-delivery";
import { formatContractMoney } from "@/lib/money";
import { readSignedDealMoney } from "@/lib/payment-engine";
import { prisma } from "@/lib/db";
import {
  milestoneAmountColumnLabel,
  orderedByAgreement,
  workspaceSummaryLines,
  workspaceTab,
  type WorkspaceMilestoneState,
} from "@/lib/workspace-decision";

export const dynamic = "force-dynamic";
export const metadata = { title: "Workspace" };

type Props = {
  params: Promise<{ fundingId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const OPEN_DISPUTE = ["open", "under_review", "refund_requested", "escalated_provider", "escalated_legal"];

export default async function CollaborationWorkPage({ params, searchParams }: Props) {
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect("/login?next=/collaboration/hub");
  const { fundingId } = await params;
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
      entries: { where: { kind: "release" }, select: { milestoneId: true, kind: true } },
      disputes: { where: { status: { in: OPEN_DISPUTE } } },
    },
  });
  if (!funding) notFound();
  const [contract, creator, settlements] = await Promise.all([
    prisma.contractDocument.findFirst({
      where: { fundingId: funding.id },
      select: { id: true, sourceJson: true },
    }).catch(() => null),
    prisma.creator.findUnique({ where: { slug: funding.creatorSlug }, select: { displayName: true } }).catch(() => null),
    prisma.milestoneSettlementV4.findMany({
      where: { fundingId: funding.id },
      select: { milestoneId: true, payoutState: true },
    }).catch(() => []),
  ]);
  const business = access.audience === "business";
  const plan = (funding.feeSnapshotJson as { financialPlan?: unknown } | null)?.financialPlan;
  const money = memberDealView({
    role: business ? "business" : "influencer",
    grossCents: funding.grossCents,
    feeCents: funding.feeCents,
    plan,
  });
  const signed = readSignedDealMoney(plan);
  const quote = plan && typeof plan === "object" && "signedQuote" in plan
    ? (plan as { signedQuote?: { milestoneAllocations?: { grossCents?: number; businessCollaborationFeeCents?: number; influencerNetCents?: number }[] } }).signedQuote
    : null;
  const allocations = Array.isArray(quote?.milestoneAllocations) ? quote.milestoneAllocations : [];
  const allocationNets = allocations.every((row) => Number.isInteger(row?.influencerNetCents))
    ? allocations.map((row) => Number(row.influencerNetCents))
    : null;
  const ordered = orderedByAgreement(funding.milestones);
  const amountHeading = milestoneAmountColumnLabel({
    amountCents: ordered.map((milestone) => milestone.amountCents),
    influencerReceivesCents: signed?.influencerReceivesCents ?? null,
    allocationNetCents: allocationNets && allocationNets.length === ordered.length ? allocationNets : null,
  });
  const query = Object.fromEntries(
    Object.entries(await searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );
  const collaborationsHref = account.role === "AGENCY"
    ? "/agency?view=campaigns"
    : business
      ? "/collaboration/business"
      : "/collaboration/hub?view=collaborations";
  const notices = [
    query.submitted ? { tone: "ok" as const, text: "Version submitted. The review window has started." } : null,
    query.added ? { tone: "ok" as const, text: "Files added. Nothing was paid." } : null,
    query.revised ? { tone: "ok" as const, text: "Revision requested on that version." } : null,
    query.approved ? { tone: "ok" as const, text: "That version was approved. Bank payout stays unconfirmed." } : null,
    query.sent ? { tone: "ok" as const, text: "Message sent. It does not move money." } : null,
    // Inline popup errors keep focus; only surface page chrome errors when the dialog is closed.
    query.error && !query.focus && !query.release ? { tone: "error" as const, text: query.error } : null,
  ].filter((notice): notice is { tone: "ok" | "error"; text: string } => Boolean(notice));

  return (
    <WorkspacePanel
      funding={{ id: funding.id, status: funding.status, title: funding.title, currency: funding.currency }}
      business={business}
      actor={{ audience: business ? "business" : "creator", assigned: !business }}
      counterparty={business ? creator?.displayName || funding.creatorSlug : funding.businessName}
      collaborationsHref={collaborationsHref}
      contractHref={contract ? `/collaboration/contracts/${contract.id}` : null}
      summary={workspaceSummaryLines(money).map((line) => ({
        label: line.label,
        amount: formatContractMoney(line.amountCents, funding.currency),
      }))}
      amountHeading={amountHeading}
      milestones={ordered.map((milestone, index) => {
        const openDispute = funding.disputes.find((row) => row.milestoneId === milestone.id || row.milestoneId == null);
        const allocation = allocations[index];
        const visible = visibleSubmissions(milestone.submissions, access.audience, access.actorSlug);
        const milestoneState: WorkspaceMilestoneState = {
          fundingStatus: funding.status,
          milestoneStatus: milestone.status,
          revisionCount: milestone.revisionCount,
          revisionLimit: milestone.revisionLimit,
          disputeOpen: Boolean(openDispute),
          payoutConfirmed: funding.entries.some((entry) => entry.milestoneId === milestone.id),
          bankPayoutConfirmed: settlements.some((row) => row.milestoneId === milestone.id && row.payoutState === "paid"),
          submissions: visible.map((row) => ({
            version: row.version,
            status: row.status,
            note: row.note,
            linkUrl: row.linkUrl,
            reviewNote: row.reviewNote,
          })),
        };
        return {
          id: milestone.id,
          title: milestone.title,
          amountLabel: formatContractMoney(milestone.amountCents, funding.currency),
          state: milestoneState,
          disputeNote: openDispute
            ? `A dispute holds ${formatContractMoney(milestone.amountCents, funding.currency)} on this milestone.`
            : null,
          grossCents: Number(allocation?.grossCents ?? milestone.amountCents),
          businessFeeCents: Number(allocation?.businessCollaborationFeeCents ?? 0),
          reviewFiles: visible.flatMap((row) =>
            row.files.map((file) => ({ id: file.id, fileName: file.fileName, version: row.version })),
          ),
        };
      })}
      files={ordered.flatMap((milestone) =>
        milestone.files.map((file) => ({ id: file.id, fileName: file.fileName, milestoneTitle: milestone.title })),
      )}
      briefScope={readScope(contract?.sourceJson)}
      query={{ ...query, tab: workspaceTab(query.tab) }}
      notices={notices}
    />
  );
}

function readScope(source: unknown) {
  if (!source || typeof source !== "object" || !("scope" in source)) return null;
  const scope = (source as { scope?: unknown }).scope;
  return typeof scope === "string" && scope.trim() ? scope.trim() : null;
}
