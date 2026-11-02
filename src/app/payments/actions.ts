"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { isBusinessRole } from "@/lib/account-audience";
import { checkoutUsesStoredCorridor } from "@/lib/corridor-checkout";
import { assertFundingAccess, requireBusinessFundingAccess } from "@/lib/funding-access";
import { openFundingCollection } from "@/lib/provider-collection";
import { prisma } from "@/lib/db";
import {
  approveFundingMilestone,
  requestChangeOrder,
  requestFundingRevision,
  stopRecurringSeries,
  submitFundingMilestone,
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
  const route = checkoutUsesStoredCorridor(funding);
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
  const result = await submitFundingMilestone(access.funding.id, milestoneId);
  if (!result.ok) fail(result.error);
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  redirect("/payments?submitted=1");
}

export async function actionRequestRevision(formData: FormData) {
  const account = await requirePaymentsAccount();
  const fundingId = String(formData.get("dealId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const access = requireBusinessFundingAccess(await assertFundingAccess(account, fundingId));
  if (!access.ok) fail(access.error);
  const result = await requestFundingRevision(access.funding.id, milestoneId, String(formData.get("note") ?? ""));
  if (!result.ok) fail(result.error);
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  redirect("/payments?revised=1");
}

export async function actionApproveMilestone(formData: FormData) {
  const account = await requirePaymentsAccount();
  const fundingId = String(formData.get("dealId") ?? "");
  const milestoneId = String(formData.get("milestoneId") ?? "");
  const access = requireBusinessFundingAccess(await assertFundingAccess(account, fundingId));
  if (!access.ok) fail(access.error);
  const result = await approveFundingMilestone(access.funding.id, milestoneId);
  if (!result.ok) fail(result.error);
  revalidatePath("/payments");
  redirect("/payments?approved=1");
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
