"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { isBusinessRole } from "@/lib/account-audience";
import { checkoutUsesStoredCorridor } from "@/lib/corridor-checkout";
import { newCheckoutAllowed, readRouteSnapshot } from "@/lib/payment-route";
import { filesFromForm, saveDeliverableFiles, validateDeliverableFiles } from "@/lib/deliverable-files";
import { markSubmissionVersion, submitMilestoneWork } from "@/lib/milestone-delivery";
import { reviewVersionDecision } from "@/lib/version-review";
import { recordsDisagree, workspaceMutationAllowed, workspaceTab, type WorkspaceMilestoneState } from "@/lib/workspace-decision";
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
import {
  acceptMemberSettlement,
  disputeMemberSettlement,
  questionMemberSettlement,
  requestMemberCancellation,
  type SettlementParty,
} from "@/lib/member-settlement";

const LOGIN = "/login?next=/payments&gate=payments";

async function requirePaymentsAccount() {
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect(LOGIN);
  return account;
}

function fail(message: string): never {
  redirect(`/payments?error=${encodeURIComponent(message)}`);
}

function failWork(fundingId: string, message: string): never {
  redirect(`/collaboration/work/${fundingId}?error=${encodeURIComponent(message)}`);
}

/** Soft deliverable failures stay on the workroom focus dialog (COR-20). */
export type WorkroomActionResult = {
  ok: false;
  error: string;
  errorKind?: "validation" | "upload" | "file" | "auth";
};

function workroomFocusPath(fundingId: string, formData: FormData, extra: Record<string, string | undefined> = {}) {
  const tab = workspaceTab(String(formData.get("tab") ?? ""));
  const params = new URLSearchParams();
  params.set("tab", tab);
  const focus = String(formData.get("milestoneId") ?? formData.get("focus") ?? "").trim();
  const intent = String(formData.get("intent") ?? "").trim();
  const version = String(formData.get("versionNumber") ?? formData.get("version") ?? "").trim();
  const review = String(formData.get("review") ?? "").trim();
  if (focus) params.set("focus", focus);
  if (intent) params.set("intent", intent);
  if (version) params.set("version", version);
  if (review) params.set("review", review);
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }
  return `/collaboration/work/${fundingId}?${params.toString()}`;
}

function workroomLoginNext(fundingId: string, formData: FormData) {
  return `/login?next=${encodeURIComponent(workroomFocusPath(fundingId, formData))}&gate=payments`;
}

async function requireWorkroomAccount(fundingId: string, formData: FormData) {
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect(workroomLoginNext(fundingId, formData));
  return account;
}

function workroomResult(error: string, errorKind: WorkroomActionResult["errorKind"] = "validation"): WorkroomActionResult {
  return { ok: false, error, errorKind };
}

const OPEN_DISPUTE = ["open", "under_review", "refund_requested", "escalated_provider", "escalated_legal"];

function workspaceReturn(fundingId: string, formData: FormData, flag: string, extra: Record<string, string | undefined> = {}) {
  const tab = workspaceTab(String(formData.get("tab") ?? ""));
  const params = new URLSearchParams();
  params.set("tab", tab);
  params.set(flag, "1");
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
  }
  return `/collaboration/work/${fundingId}?${params.toString()}`;
}

async function loadWorkspaceState(fundingId: string, milestoneId: string, fundingStatus: string): Promise<WorkspaceMilestoneState | null> {
  const milestone = await prisma.fundingMilestone.findFirst({
    where: { id: milestoneId, fundingId },
    select: {
      status: true,
      revisionCount: true,
      revisionLimit: true,
      submissions: { select: { version: true, status: true, note: true, linkUrl: true, reviewNote: true } },
    },
  });
  if (!milestone) return null;
  const dispute = await prisma.milestoneDispute.findFirst({
    where: {
      fundingId,
      status: { in: OPEN_DISPUTE },
      OR: [{ milestoneId }, { milestoneId: null }],
    },
    select: { id: true },
  });
  return {
    fundingStatus,
    milestoneStatus: milestone.status,
    revisionCount: milestone.revisionCount,
    revisionLimit: milestone.revisionLimit,
    disputeOpen: Boolean(dispute),
    payoutConfirmed: false,
    bankPayoutConfirmed: false,
    submissions: milestone.submissions,
  };
}

function failDeal(dealId: string, message: string): never {
  redirect(`/payments?deal=${encodeURIComponent(dealId)}&tab=settlement&error=${encodeURIComponent(message)}`);
}

function settlementParty(audience: "business" | "creator"): SettlementParty {
  return audience === "business" ? "business" : "influencer";
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

function isUploadStorageError(message: string) {
  return /could not be stored|network|temporar|try again/i.test(message);
}

export async function actionSubmitMilestone(formData: FormData): Promise<WorkroomActionResult> {
  const fundingId = String(formData.get("dealId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const account = await requireWorkroomAccount(fundingId, formData);
  const access = await assertFundingAccess(account, fundingId);
  if (!access.ok) return workroomResult(access.error, "auth");
  if (access.audience !== "creator" || !access.actorSlug) {
    return workroomResult("Only the assigned influencer can submit work.", "auth");
  }
  const files = filesFromForm(formData);
  const checked = validateDeliverableFiles(files);
  if (!checked.ok) return workroomResult(checked.error, "file");
  const workspaceState = await loadWorkspaceState(access.funding.id, milestoneId, access.funding.status);
  if (!workspaceState) return workroomResult("Milestone not found.");
  const allowed = workspaceMutationAllowed(workspaceState, { audience: "creator", assigned: true }, "submit");
  if (!allowed.ok) return workroomResult(allowed.error);
  const result = await submitMilestoneWork({
    fundingId: access.funding.id,
    milestoneId,
    creatorSlug: access.actorSlug,
    note: String(formData.get("note") ?? ""),
    linkUrl: String(formData.get("linkUrl") ?? ""),
    files: checked.files,
  });
  if (!result.ok) {
    return workroomResult(result.error, isUploadStorageError(result.error) ? "upload" : "validation");
  }
  const savedLink = String(formData.get("linkUrl") ?? "").trim()
    ? (await prisma.milestoneSubmission.findUnique({ where: { id: result.id }, select: { linkUrl: true } }))?.linkUrl
    : "";
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath(`/collaboration/work/${access.funding.id}`);
  redirect(
    workspaceReturn(access.funding.id, formData, "submitted", {
      savedAs: savedLink || undefined,
    }),
  );
}

export async function actionRequestRevision(formData: FormData): Promise<WorkroomActionResult> {
  const fundingId = String(formData.get("dealId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const account = await requireWorkroomAccount(fundingId, formData);
  const access = requireBusinessFundingAccess(await assertFundingAccess(account, fundingId));
  if (!access.ok) return workroomResult(access.error, "auth");
  const files = filesFromForm(formData);
  const checked = validateDeliverableFiles(files);
  if (!checked.ok) return workroomResult(checked.error, "file");
  const versionNumber = Number(formData.get("versionNumber"));
  const submissions = await prisma.milestoneSubmission.findMany({
    where: { milestoneId, fundingId: access.funding.id },
    select: { version: true, status: true },
  });
  const decision = reviewVersionDecision({
    versions: submissions,
    requestedVersion: versionNumber,
    intent: "revise",
    note: String(formData.get("note") ?? ""),
  });
  if (!decision.ok) return workroomResult(decision.error);
  const workspaceState = await loadWorkspaceState(access.funding.id, milestoneId, access.funding.status);
  if (!workspaceState) return workroomResult("Milestone not found.");
  const allowed = workspaceMutationAllowed(workspaceState, { audience: "business", assigned: false }, "revise", decision.version);
  if (!allowed.ok) return workroomResult(allowed.error);
  const result = await requestFundingRevision(access.funding.id, milestoneId, String(formData.get("note") ?? ""));
  if (!result.ok) return workroomResult(result.error);
  const marked = await markSubmissionVersion({
    milestoneId,
    version: decision.version,
    status: "revision_requested",
    reviewNote: String(formData.get("note") ?? ""),
  });
  if (!marked.ok) return workroomResult(marked.error);
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
    if (!stored.ok) {
      return workroomResult(stored.error, isUploadStorageError(stored.error) ? "upload" : "file");
    }
  }
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  revalidatePath(`/collaboration/work/${access.funding.id}`);
  redirect(workspaceReturn(access.funding.id, formData, "revised"));
}

export async function actionAddDeliverableFiles(formData: FormData): Promise<WorkroomActionResult> {
  const fundingId = String(formData.get("dealId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const account = await requireWorkroomAccount(fundingId, formData);
  const access = requireBusinessFundingAccess(await assertFundingAccess(account, fundingId));
  if (!access.ok) return workroomResult(access.error, "auth");
  if (access.funding.status !== "held") {
    return workroomResult("Files can be added after the deposit is confirmed.");
  }
  const files = filesFromForm(formData);
  const checked = validateDeliverableFiles(files);
  if (!checked.ok) return workroomResult(checked.error, "file");
  if (checked.files.length === 0) return workroomResult("Choose a document, media file, or zip.", "file");
  const milestone = await prisma.fundingMilestone.findFirst({
    where: { id: milestoneId, fundingId: access.funding.id },
    select: { id: true },
  });
  if (!milestone) return workroomResult("Milestone not found.");
  const workspaceState = await loadWorkspaceState(access.funding.id, milestoneId, access.funding.status);
  if (workspaceState && recordsDisagree(workspaceState).disagree) {
    return workroomResult("These records disagree. Nothing was added.");
  }
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
  if (!stored.ok) {
    return workroomResult(stored.error, isUploadStorageError(stored.error) ? "upload" : "file");
  }
  revalidatePath("/payments");
  revalidatePath(`/collaboration/work/${access.funding.id}`);
  redirect(workspaceReturn(access.funding.id, formData, "added"));
}

export async function actionApproveMilestone(formData: FormData) {
  const account = await requirePaymentsAccount();
  const fundingId = String(formData.get("dealId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const access = requireBusinessFundingAccess(await assertFundingAccess(account, fundingId));
  if (!access.ok) fail(access.error);
  const versionNumber = Number(formData.get("versionNumber"));
  const submissions = await prisma.milestoneSubmission.findMany({
    where: { milestoneId, fundingId: access.funding.id },
    select: { version: true, status: true },
  });
  const decision = reviewVersionDecision({ versions: submissions, requestedVersion: versionNumber, intent: "approve" });
  if (!decision.ok) failWork(access.funding.id, decision.error);
  const workspaceState = await loadWorkspaceState(access.funding.id, milestoneId, access.funding.status);
  if (!workspaceState) failWork(access.funding.id, "Milestone not found.");
  const allowed = workspaceMutationAllowed(workspaceState, { audience: "business", assigned: false }, "approve", decision.version);
  if (!allowed.ok) failWork(access.funding.id, allowed.error);
  const result = await approveFundingMilestone(access.funding.id, milestoneId);
  if (!result.ok) failWork(access.funding.id, result.error);
  const marked = await markSubmissionVersion({
    milestoneId,
    version: decision.version,
    status: "approved",
    reviewNote: "",
  });
  if (!marked.ok) failWork(access.funding.id, marked.error);
  await prisma.auditLog.create({
    data: {
      actor: account.email,
      action: "milestone_version_approved",
      objectType: "FundingMilestone",
      objectId: milestoneId,
      after: { fundingId: access.funding.id, version: decision.version, payoutConfirmed: false },
    },
  }).catch(() => undefined);
  revalidatePath("/payments");
  revalidatePath(`/collaboration/work/${access.funding.id}`);
  redirect(workspaceReturn(access.funding.id, formData, "approved"));
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

export async function actionRequestCancellation(formData: FormData) {
  const account = await requirePaymentsAccount();
  const fundingId = String(formData.get("dealId") ?? "");
  const access = await assertFundingAccess(account, fundingId);
  if (!access.ok) failDeal(fundingId, access.error);
  const result = await requestMemberCancellation({
    fundingId: access.funding.id,
    party: settlementParty(access.audience),
    actor: account.email,
    reason: String(formData.get("reason") ?? ""),
    note: String(formData.get("note") ?? ""),
  });
  if (!result.ok) failDeal(access.funding.id, result.error);
  revalidatePath("/payments");
  redirect(`/payments?deal=${access.funding.id}&tab=settlement&settlement=${result.status}`);
}

export async function actionAcceptSettlement(formData: FormData) {
  const account = await requirePaymentsAccount();
  const fundingId = String(formData.get("dealId") ?? "");
  const access = await assertFundingAccess(account, fundingId);
  if (!access.ok) failDeal(fundingId, access.error);
  const versionNumber = Number(formData.get("versionNumber"));
  if (!Number.isInteger(versionNumber)) failDeal(access.funding.id, "This proposal version is no longer current. Nothing was refunded.");
  const result = await acceptMemberSettlement({
    fundingId: access.funding.id,
    party: settlementParty(access.audience),
    actor: account.email,
    versionNumber,
  });
  if (!result.ok) failDeal(access.funding.id, result.error);
  revalidatePath("/payments");
  redirect(`/payments?deal=${access.funding.id}&tab=settlement&settlement=${result.both ? "accepted" : "noted"}`);
}

export async function actionQuestionSettlement(formData: FormData) {
  const account = await requirePaymentsAccount();
  const fundingId = String(formData.get("dealId") ?? "");
  const access = await assertFundingAccess(account, fundingId);
  if (!access.ok) failDeal(fundingId, access.error);
  const versionNumber = Number(formData.get("versionNumber"));
  if (!Number.isInteger(versionNumber)) failDeal(access.funding.id, "This proposal version is no longer current. Nothing was refunded.");
  const result = await questionMemberSettlement({
    fundingId: access.funding.id,
    party: settlementParty(access.audience),
    actor: account.email,
    versionNumber,
    body: String(formData.get("body") ?? ""),
  });
  if (!result.ok) failDeal(access.funding.id, result.error);
  revalidatePath("/payments");
  redirect(`/payments?deal=${access.funding.id}&tab=settlement&settlement=question`);
}

export async function actionDisputeSettlement(formData: FormData) {
  const account = await requirePaymentsAccount();
  const fundingId = String(formData.get("dealId") ?? "");
  const access = await assertFundingAccess(account, fundingId);
  if (!access.ok) failDeal(fundingId, access.error);
  const versionNumber = Number(formData.get("versionNumber"));
  if (!Number.isInteger(versionNumber)) failDeal(access.funding.id, "This proposal version is no longer current. Nothing was refunded.");
  const result = await disputeMemberSettlement({
    fundingId: access.funding.id,
    party: settlementParty(access.audience),
    actor: account.email,
    versionNumber,
    note: String(formData.get("note") ?? ""),
  });
  if (!result.ok) failDeal(access.funding.id, result.error);
  revalidatePath("/payments");
  redirect(`/payments?deal=${access.funding.id}&tab=settlement&settlement=disputed`);
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
