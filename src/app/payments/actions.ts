"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { isBusinessRole } from "@/lib/account-audience";
import { checkoutUsesStoredCorridor } from "@/lib/corridor-checkout";
import { newCheckoutAllowed, readRouteSnapshot } from "@/lib/payment-route";
import { filesFromForm, saveDeliverableFiles, validateDeliverableFiles } from "@/lib/deliverable-files";
import { markLatestSubmission, submitMilestoneWork } from "@/lib/milestone-delivery";
import { assertFundingAccess, requireBusinessFundingAccess } from "@/lib/funding-access";
import { openFundingCollection } from "@/lib/provider-collection";
import { parseDepositMethod, startFundingDeposit } from "@/lib/funding-checkout";
import { prisma } from "@/lib/db";
import {
  approveFundingMilestone,
  requestChangeOrder,
  requestFundingRevision,
  stopRecurringSeries,
} from "@/lib/marketplace-ledger";
import { addDisputeEvidence, cancelUnconfirmedFunding, openMilestoneDispute } from "@/lib/milestone-disputes";

const LOGIN = "/login?next=/payments&gate=payments";

async function requirePaymentsAccount() {
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect(LOGIN);
  return account;
}

function fail(message: string): never {
  redirect(`/payments?error=${encodeURIComponent(message)}`);
}

/** Public create-deal path is closed — fund only from a signed contract. */
export async function actionCreateDeal() {
  await requirePaymentsAccount();
  fail("Fund from a signed collaboration contract. Open the contract and use Start funding.");
}

export async function actionOpenFundingCheckout(formData: FormData) {
  const account = await requirePaymentsAccount();
  const fundingId = String(formData.get("dealId") ?? "").trim();
  const access = requireBusinessFundingAccess(await assertFundingAccess(account, fundingId));
  if (!access.ok) fail(access.error);

  const funding = await prisma.collaborationFunding.findUnique({
    where: { id: access.funding.id },
    include: { milestones: true },
  });
  if (!funding || funding.status !== "awaiting_provider") {
    fail("This funding is not waiting for a provider.");
  }
  const corridor = await prisma.countryActivationCorridor.findUnique({
    where: { countryCode: funding.jurisdictionCode },
    select: { active: true },
  });
  const checkoutGate = newCheckoutAllowed({ corridorActive: corridor?.active ?? null, fundingStatus: funding.status });
  if (!checkoutGate.ok) fail(checkoutGate.error);
  const storedRoute = readRouteSnapshot(funding.routeSnapshotJson);
  const route = checkoutUsesStoredCorridor({
    collectionProviderCode: storedRoute?.collectionProvider || funding.collectionProviderCode,
    payoutMethod: funding.payoutMethod,
  });
  if (!route.ok) fail(route.error);
  const origin = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const opened = await openFundingCollection({
    providerCode: route.collectionProviderCode,
    fundingId: funding.id,
    amountCents: funding.grossCents,
    currency: funding.currency,
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    milestones: funding.milestones.map((milestone) => ({ id: milestone.id, amountCents: milestone.amountCents })),
    origin,
  });
  if (!opened.ok) fail(opened.error);
  if (opened.url) redirect(opened.url);
  revalidatePath("/payments");
  redirect(`/payments?checkout=${encodeURIComponent(opened.reference)}`);
}

export async function actionStartFundingDeposit(formData: FormData) {
  const account = await requirePaymentsAccount();
  const fundingId = String(formData.get("fundingId") ?? "").trim();
  const access = requireBusinessFundingAccess(await assertFundingAccess(account, fundingId));
  if (!access.ok) fail(access.error);
  const method = parseDepositMethod(String(formData.get("method") ?? ""));
  if (!method) {
    redirect(
      `/payments/checkout/${access.funding.id}?error=${encodeURIComponent("Choose card, online ACH, ACH wire, or check. Nothing was charged.")}`,
    );
  }
  const origin = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const started = await startFundingDeposit({
    fundingId: access.funding.id,
    method,
    email: String(formData.get("email") ?? ""),
    note: String(formData.get("note") ?? ""),
    origin,
  });
  if (!started.ok) {
    redirect(`/payments/checkout/${access.funding.id}?error=${encodeURIComponent(started.error)}`);
  }
  revalidatePath("/payments");
  revalidatePath(`/payments/checkout/${access.funding.id}`);
  if (started.kind === "gateway") redirect(started.url);
  redirect(`/payments/checkout/${access.funding.id}?recorded=1`);
}

export async function actionRequestChangeOrder(formData: FormData) {
  const account = await requirePaymentsAccount();
  const fundingId = String(formData.get("dealId") ?? "");
  const access = requireBusinessFundingAccess(await assertFundingAccess(account, fundingId));
  if (!access.ok) fail(access.error);
  const grossCents = Number(String(formData.get("grossUsd") ?? "").replace(/[^0-9.]/g, ""));
  const cents = Number.isFinite(grossCents) && grossCents > 0 ? Math.round(grossCents * 100) : 0;
  const result = await requestChangeOrder({
    fundingId: access.funding.id,
    grossCents: cents,
    note: String(formData.get("note") ?? ""),
  });
  if (!result.ok) fail(result.error);
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/admin/marketplace");
  redirect("/payments?changed=1");
}

export async function actionSubmitMilestone(formData: FormData) {
  const account = await requirePaymentsAccount();
  const fundingId = String(formData.get("dealId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const access = await assertFundingAccess(account, fundingId);
  if (!access.ok) fail(access.error);
  if (access.audience !== "creator" || !access.actorSlug) {
    fail("Only the assigned influencer can submit work.");
  }
  const files = filesFromForm(formData);
  const checked = validateDeliverableFiles(files);
  if (!checked.ok) fail(checked.error);
  const result = await submitMilestoneWork({
    fundingId: access.funding.id,
    milestoneId,
    creatorSlug: access.actorSlug,
    note: String(formData.get("note") ?? ""),
    linkUrl: String(formData.get("linkUrl") ?? ""),
    files: checked.files,
  });
  if (!result.ok) fail(result.error);
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath(`/collaboration/work/${access.funding.id}`);
  redirect(`/collaboration/work/${access.funding.id}?submitted=1`);
}

export async function actionRequestRevision(formData: FormData) {
  const account = await requirePaymentsAccount();
  const fundingId = String(formData.get("dealId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const access = requireBusinessFundingAccess(await assertFundingAccess(account, fundingId));
  if (!access.ok) fail(access.error);
  const files = filesFromForm(formData);
  const checked = validateDeliverableFiles(files);
  if (!checked.ok) fail(checked.error);
  const result = await requestFundingRevision(access.funding.id, milestoneId, String(formData.get("note") ?? ""));
  if (!result.ok) fail(result.error);
  await markLatestSubmission({ milestoneId, status: "revision_requested", reviewNote: String(formData.get("note") ?? "") });
  if (checked.files.length > 0) {
    const latest = await prisma.milestoneSubmission.findFirst({
      where: { milestoneId, fundingId: access.funding.id },
      orderBy: { version: "desc" },
      select: { id: true },
    });
    const stored = await saveDeliverableFiles({
      fundingId: access.funding.id,
      milestoneId,
      submissionId: latest?.id ?? null,
      audience: "business",
      files: checked.files,
    });
    if (!stored.ok) fail(stored.error);
  }
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath(`/collaboration/work/${access.funding.id}`);
  redirect(`/collaboration/work/${access.funding.id}?revised=1`);
}

export async function actionAddDeliverableFiles(formData: FormData) {
  const account = await requirePaymentsAccount();
  const fundingId = String(formData.get("dealId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const access = requireBusinessFundingAccess(await assertFundingAccess(account, fundingId));
  if (!access.ok) fail(access.error);
  if (access.funding.status !== "held") fail("Files can be added after the deposit is confirmed.");
  const files = filesFromForm(formData);
  const checked = validateDeliverableFiles(files);
  if (!checked.ok) fail(checked.error);
  if (checked.files.length === 0) fail("Choose a document, media file, or zip.");
  const milestone = await prisma.fundingMilestone.findFirst({
    where: { id: milestoneId, fundingId: access.funding.id },
    select: { id: true },
  });
  if (!milestone) fail("Milestone not found.");
  const latest = await prisma.milestoneSubmission.findFirst({
    where: { milestoneId, fundingId: access.funding.id },
    orderBy: { version: "desc" },
    select: { id: true },
  });
  const stored = await saveDeliverableFiles({
    fundingId: access.funding.id,
    milestoneId,
    submissionId: latest?.id ?? null,
    audience: "business",
    files: checked.files,
  });
  if (!stored.ok) fail(stored.error);
  revalidatePath("/payments");
  revalidatePath(`/collaboration/work/${access.funding.id}`);
  redirect(`/collaboration/work/${access.funding.id}?submitted=1`);
}

export async function actionApproveMilestone(formData: FormData) {
  const account = await requirePaymentsAccount();
  const fundingId = String(formData.get("dealId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const access = requireBusinessFundingAccess(await assertFundingAccess(account, fundingId));
  if (!access.ok) fail(access.error);
  const result = await approveFundingMilestone(access.funding.id, milestoneId);
  if (!result.ok) fail(result.error);
  await markLatestSubmission({ milestoneId, status: "approved", reviewNote: "" });
  revalidatePath("/payments");
  revalidatePath(`/collaboration/work/${access.funding.id}`);
  redirect(`/collaboration/work/${access.funding.id}?approved=1`);
}

export async function actionCancelPrefund(formData: FormData) {
  const account = await requirePaymentsAccount();
  const fundingId = String(formData.get("dealId") ?? "");
  const access = requireBusinessFundingAccess(await assertFundingAccess(account, fundingId));
  if (!access.ok) fail(access.error);
  const result = await cancelUnconfirmedFunding(access.funding.id);
  if (!result.ok) fail(result.error);
  revalidatePath("/payments");
  redirect("/payments?cancelled=1");
}

export async function actionAddEvidence(formData: FormData) {
  const account = await requirePaymentsAccount();
  const fundingId = String(formData.get("dealId") ?? "");
  const access = await assertFundingAccess(account, fundingId);
  if (!access.ok) fail(access.error);
  const result = await addDisputeEvidence({
    disputeId: String(formData.get("disputeId") ?? ""),
    fundingId: access.funding.id,
    author: access.audience === "business" ? "business" : "creator",
    body: String(formData.get("body") ?? ""),
    url: String(formData.get("url") ?? ""),
  });
  if (!result.ok) fail(result.error);
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath("/admin/trust");
  redirect("/payments?evidence=1");
}

export async function actionStopSeries(formData: FormData) {
  const account = await requirePaymentsAccount();
  if (!isBusinessRole(account.role)) fail("Only the business on this funding can do that.");
  const scheduleId = String(formData.get("scheduleId") ?? "").trim();
  if (!scheduleId) fail("Choose a schedule.");
  const workspace = await prisma.businessWorkspace.findUnique({
    where: { ownerUserId: account.id },
    select: { id: true },
  });
  if (!workspace?.id) fail("You do not have access to that funding.");
  const owned = await prisma.collaborationFunding.findFirst({
    where: { scheduleId, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!owned) fail("You do not have access to that funding.");
  const result = await stopRecurringSeries(scheduleId);
  if (!result.ok) fail(result.error);
  revalidatePath("/payments");
  redirect("/payments?stopped=1");
}

/** Ambassador / unsigned follow-on prefunds stay closed on the public payments UI. */
export async function actionConvertAmbassador() {
  await requirePaymentsAccount();
  fail("Fund from a signed collaboration contract. Open the contract and use Start funding.");
}

export async function actionOpenDispute(formData: FormData) {
  const account = await requirePaymentsAccount();
  const fundingId = String(formData.get("dealId") ?? "");
  const access = await assertFundingAccess(account, fundingId);
  if (!access.ok) fail(access.error);
  const result = await openMilestoneDispute({
    fundingId: access.funding.id,
    milestoneId: String(formData.get("milestoneId") ?? ""),
    openedBy: access.audience === "business" ? "business" : "creator",
    reasonId: String(formData.get("reasonId") ?? ""),
    details: String(formData.get("details") ?? ""),
  });
  if (!result.ok) fail(result.error);
  revalidatePath("/payments");
  revalidatePath("/admin/trust");
  revalidatePath("/trust");
  redirect("/payments?disputed=1");
}
