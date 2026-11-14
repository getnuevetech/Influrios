"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { isBusinessRole } from "@/lib/account-audience";
import { prisma } from "@/lib/db";
import { assertFundingAccess } from "@/lib/funding-access";
import { approveFundingMilestone } from "@/lib/marketplace-ledger";
import { queueProviderInstruction } from "@/lib/payment-provider-adapter";
import { readAgreementVersion, readMilestoneAllocation } from "@/lib/payment-account-routing";
import { commitMilestoneReleasePlan } from "@/lib/payment-standard-store";
import { readSignedDealMoney } from "@/lib/payment-engine";
import { getLaunchGate } from "@/lib/launch-gate";

function fail(fundingId: string, message: string): never {
  redirect(`/collaboration/work/${fundingId}?error=${encodeURIComponent(message)}`);
}

export async function actionApproveAndRelease(formData: FormData) {
  const account = await getAccountSession();
  if (!account || !isBusinessRole(account.role)) fail(String(formData.get("dealId") ?? ""), "Only the business can approve this version.");
  const fundingId = String(formData.get("dealId") ?? "").trim();
  const milestoneId = String(formData.get("milestoneId") ?? "").trim();
  const version = Number(formData.get("versionNumber"));
  if (formData.get("acknowledge") !== "on") fail(fundingId, "Confirm the exact version before release. Nothing was released.");
  const access = await assertFundingAccess(account, fundingId);
  if (!access.ok || access.audience !== "business") fail(fundingId, "You cannot release this collaboration.");
  const funding = await prisma.collaborationFunding.findUnique({
    where: { id: access.funding.id },
    include: {
      milestones: { orderBy: { sortOrder: "asc" } },
      disputes: { where: { status: { in: ["open", "under_review", "refund_requested"] } } },
    },
  });
  if (!funding) fail(fundingId, "This collaboration was not found.");
  if (funding.status !== "held" && funding.status !== "completed") {
    fail(funding.id, "Funding is not confirmed. Nothing was released.");
  }
  const milestone = funding.milestones.find((row) => row.id === milestoneId);
  if (!milestone) fail(funding.id, "That milestone is not on this agreement.");
  if (funding.disputes.some((row) => row.milestoneId == null || row.milestoneId === milestone.id)) {
    fail(funding.id, "A dispute is open. Release stays paused.");
  }
  const submission = await prisma.milestoneSubmission.findFirst({
    where: { milestoneId: milestone.id, version },
  });
  if (!submission || submission.status === "revision_requested") {
    fail(funding.id, "That version is no longer the one under review. Nothing was released.");
  }
  const creator = await prisma.creator.findUnique({
    where: { slug: funding.creatorSlug },
    select: { payoutProfile: { select: { stripeConnectAccountId: true, providerConnectedAccountId: true, primaryStatus: true } } },
  });
  const payoutReady =
    Boolean(creator?.payoutProfile?.stripeConnectAccountId || creator?.payoutProfile?.providerConnectedAccountId) &&
    creator?.payoutProfile?.primaryStatus !== "UNVERIFIED";
  if (!payoutReady) {
    fail(funding.id, "Work was not approved. Payout setup still needs attention, so release stays blocked.");
  }
  const quote = (funding.feeSnapshotJson as { financialPlan?: { signedQuote?: { milestoneAllocations?: unknown; agreementVersion?: unknown } } } | null)
    ?.financialPlan?.signedQuote;
  const signed = readSignedDealMoney((funding.feeSnapshotJson as { financialPlan?: unknown } | null)?.financialPlan);
  if (!signed) fail(funding.id, "The signed total is missing. Nothing was released.");
  const allocation = readMilestoneAllocation({ allocations: quote?.milestoneAllocations, milestoneId: milestone.id });
  if (allocation.kind === "reject") fail(funding.id, allocation.error);
  if (allocation.kind === "legacy") {
    const approved = await approveFundingMilestone(funding.id, milestone.id);
    if (!approved.ok) fail(funding.id, approved.error);
    await prisma.milestoneSubmission.updateMany({
      where: { milestoneId: milestone.id, version },
      data: { status: "approved" },
    });
  } else {
    const agreement = readAgreementVersion(quote);
    if (!agreement.ok) fail(funding.id, agreement.error);
    const gate = await getLaunchGate().catch(() => null);
    const committed = await commitMilestoneReleasePlan({
      fundingId: funding.id,
      milestoneId: milestone.id,
      submissionVersion: version,
      agreementVersion: agreement.version,
      currency: funding.currency,
      grossCents: allocation.row.grossCents,
      businessFeeCents: allocation.row.businessCollaborationFeeCents,
      influencerFeeCents: allocation.row.influencerFeeCents,
      rightsActivateOn: milestone.rightsActivateOn,
      rightsStatus: milestone.rightsStatus,
      releaseApproved: gate?.automaticReleaseApprovalEnabled === true,
    });
    if (!committed.ok) fail(funding.id, committed.error);
  }
  revalidatePath(`/collaboration/work/${funding.id}`);
  revalidatePath("/payments");
  redirect(`/collaboration/work/${funding.id}?approved=1`);
}

export async function actionExecuteApprovedRefund(formData: FormData) {
  const { getAdminSession, hasPermission } = await import("@/lib/admin-auth");
  const session = await getAdminSession();
  if (!session || !hasPermission(session, "collab_finance.manage")) {
    redirect("/admin/login?next=/admin/finance");
  }
  const fundingId = String(formData.get("fundingId") ?? "").trim();
  const settlement = await prisma.fundingSettlement.findFirst({
    where: { fundingId, status: "accepted" },
    orderBy: { versionNumber: "desc" },
  });
  if (!settlement) redirect("/admin/finance?error=" + encodeURIComponent("There is no accepted refund to execute."));
  const proposal = settlement.proposalJson as { businessRefundCents?: number };
  const amount = proposal.businessRefundCents;
  if (!Number.isInteger(amount) || Number(amount) <= 0) {
    redirect("/admin/finance?error=" + encodeURIComponent("The accepted refund amount is missing. Nothing was refunded."));
  }
  const queued = await queueProviderInstruction({
    instruction: "partial_refund",
    fundingId,
    amountCents: Number(amount),
    actor: session.email,
  });
  if (!queued.ok) redirect("/admin/finance?error=" + encodeURIComponent(queued.error));
  await prisma.reconciliationCaseV4.create({
    data: {
      fundingId,
      kind: "refund",
      status: "processing",
      reason: `Refund instruction ${queued.reference} is waiting for provider confirmation.`,
    },
  });
  revalidatePath("/admin/finance");
  redirect("/admin/finance?queued=1");
}
