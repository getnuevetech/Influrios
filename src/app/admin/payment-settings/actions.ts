"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { saveCanonicalCountryRoute } from "@/lib/canonical-country-route";
import { getLaunchGate, recordProviderStagingTraces, saveDeferredFundingSwitches, saveLaunchApprovals } from "@/lib/launch-gate";
import { parseBackoffHours, saveProcessTimings } from "@/lib/process-timing";

export async function actionSaveCanonicalCountryRoute(formData: FormData) {
  const session = await requireAdminAction("collab_finance.manage");
  const countryCode = String(formData.get("countryCode") ?? "");
  try {
    await saveCanonicalCountryRoute({
      countryCode,
      actor: session.email,
      currency: String(formData.get("currency") ?? ""),
      minorDigits: Number(formData.get("minorDigits") ?? ""),
      collectionProviderCode: String(formData.get("collectionProviderCode") ?? ""),
      holdingProviderCode: String(formData.get("holdingProviderCode") ?? ""),
      payoutGatewayCode: String(formData.get("payoutGatewayCode") ?? ""),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the country route.";
    redirect(`/admin/payment-settings?section=routes&error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/payment-settings");
  revalidatePath("/admin/marketplace/settings");
  redirect(`/admin/payment-settings?section=routes&saved=${encodeURIComponent(countryCode.trim().toUpperCase())}`);
}

function minorUnits(formData: FormData, name: string) {
  const value = Number(String(formData.get(name) ?? "").trim());
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export async function actionSaveLaunchApprovals(formData: FormData) {
  const session = await requireAdminAction("marketplace.manage");
  try {
    await saveLaunchApprovals({
      actor: session.email,
      reason: String(formData.get("reason") ?? ""),
      approvals: {
        feeSchedulesApproved: formData.get("feeSchedulesApproved") === "on",
        taxTreatmentApproved: formData.get("taxTreatmentApproved") === "on",
        earningRefundPolicyApproved: formData.get("earningRefundPolicyApproved") === "on",
        providerRouteApproved: formData.get("providerRouteApproved") === "on",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the launch approvals.";
    redirect(`/admin/payment-settings?section=routes&error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/payment-settings");
  redirect("/admin/payment-settings?section=routes&saved=launch-approvals");
}

export async function actionSaveSandboxTestAccounts(formData: FormData) {
  const session = await requireAdminAction("marketplace.manage");
  try {
    const { saveSandboxTestEmails } = await import("@/lib/launch-gate");
    await saveSandboxTestEmails({
      actor: session.email,
      reason: String(formData.get("reason") ?? ""),
      emails: String(formData.get("emails") ?? ""),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the test accounts.";
    redirect(`/admin/payment-settings?section=routes&error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/payment-settings");
  redirect("/admin/payment-settings?section=routes&saved=test-accounts");
}

export async function actionSaveDeferredFunding(formData: FormData) {
  const session = await requireAdminAction("marketplace.manage");
  const gate = await getLaunchGate().catch(() => null);
  try {
    await saveDeferredFundingSwitches({
      actor: session.email,
      reason: String(formData.get("reason") ?? ""),
      switches: {
        crossBorderFundingEnabled: formData.get("crossBorderFundingEnabled") === "on",
        teamFundingEnabled: formData.get("teamFundingEnabled") === "on",
        automaticMilestoneApprovalEnabled: formData.get("automaticMilestoneApprovalEnabled") === "on",
        automaticProviderSwitchingEnabled: formData.get("automaticProviderSwitchingEnabled") === "on",
        allInBudgetEntryEnabled: formData.get("allInBudgetEntryEnabled") === "on",
        automaticReleaseApprovalEnabled: gate?.automaticReleaseApprovalEnabled === true,
        automaticProviderReleaseEnabled: gate?.automaticProviderReleaseEnabled === true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the funding switches.";
    redirect(`/admin/payment-settings?section=routes&error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/payment-settings");
  redirect("/admin/payment-settings?section=routes&saved=funding-switches");
}

function whole(formData: FormData, name: string) {
  const value = Number(String(formData.get(name) ?? "").trim());
  return Number.isInteger(value) ? value : null;
}

export async function actionSaveProcessTimings(formData: FormData) {
  const session = await requireAdminAction("marketplace.manage");
  const backoff = parseBackoffHours(String(formData.get("failedPayoutBackoffHours") ?? ""));
  const reviewWindowHours = whole(formData, "reviewWindowHours");
  const quoteValidHours = whole(formData, "quoteValidHours");
  const unknownCommandMinutes = whole(formData, "unknownCommandMinutes");
  const providerCommandMaxAttempts = whole(formData, "providerCommandMaxAttempts");
  const disputeSlaHours = whole(formData, "disputeSlaHours");
  const providerHoldWarnHours = whole(formData, "providerHoldWarnHours");
  const failedPayoutMaxAttempts = whole(formData, "failedPayoutMaxAttempts");
  const staleFundingHours = whole(formData, "staleFundingHours");
  const reviewDeadlineLeadHours = whole(formData, "reviewDeadlineLeadHours");
  const teamProposalLifeDays = whole(formData, "teamProposalLifeDays");
  if (
    !backoff ||
    reviewWindowHours == null ||
    quoteValidHours == null ||
    unknownCommandMinutes == null ||
    providerCommandMaxAttempts == null ||
    disputeSlaHours == null ||
    providerHoldWarnHours == null ||
    failedPayoutMaxAttempts == null ||
    staleFundingHours == null ||
    reviewDeadlineLeadHours == null ||
    teamProposalLifeDays == null
  ) {
    redirect(`/admin/payment-settings?section=routes&error=${encodeURIComponent("Enter whole numbers for every process clock.")}`);
  }
  try {
    await saveProcessTimings(
      {
        reviewWindowHours,
        quoteValidHours,
        unknownCommandMinutes,
        providerCommandMaxAttempts,
        disputeSlaHours,
        providerHoldWarnHours,
        failedPayoutBackoffHours: backoff,
        failedPayoutMaxAttempts,
        staleFundingHours,
        reviewDeadlineLeadHours,
        teamProposalLifeDays,
      },
      session.email,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the process clocks.";
    redirect(`/admin/payment-settings?section=routes&error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/payment-settings");
  revalidatePath("/admin/marketplace/settings");
  redirect("/admin/payment-settings?section=routes&saved=process-timing");
}

export async function actionRecordProviderTrace(formData: FormData) {
  const session = await requireAdminAction("marketplace.manage");
  const businessPaysCents = minorUnits(formData, "businessPaysCents");
  const influencerReceivesCents = minorUnits(formData, "influencerReceivesCents");
  const platformFeesTotalCents = minorUnits(formData, "platformFeesTotalCents");
  const taxCents = minorUnits(formData, "taxCents");
  if (
    businessPaysCents == null ||
    influencerReceivesCents == null ||
    platformFeesTotalCents == null ||
    taxCents == null
  ) {
    redirect(`/admin/payment-settings?section=routes&error=${encodeURIComponent("Trace amounts must be whole minor units.")}`);
  }
  try {
    await recordProviderStagingTraces({
      actor: session.email,
      currency: String(formData.get("currency") ?? ""),
      businessPaysCents,
      influencerReceivesCents,
      platformFeesTotalCents,
      taxCents,
      collectionRef: String(formData.get("collectionRef") ?? ""),
      holdingRef: String(formData.get("holdingRef") ?? ""),
      releaseRef: String(formData.get("releaseRef") ?? ""),
      payoutRef: String(formData.get("payoutRef") ?? ""),
      refundRef: String(formData.get("refundRef") ?? ""),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The test transaction was not recorded.";
    redirect(`/admin/payment-settings?section=routes&error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/payment-settings");
  redirect("/admin/payment-settings?section=routes&saved=provider-trace");
}

export async function actionSaveOperationsAccount(formData: FormData) {
  return saveSubAccount(formData, "operations");
}

export async function actionSaveCollectionAccount(formData: FormData) {
  return saveSubAccount(formData, "collection");
}

/** Save an Influrios-owned Stripe sub-account after Stripe confirms it is a connected account of this platform. */
async function saveSubAccount(formData: FormData, role: "operations" | "collection") {
  const session = await requireAdminAction("collab_finance.manage");
  const field = role === "operations" ? "operationsStripeAccountId" : "collectionStripeAccountId";
  const label = role === "operations" ? "Operations" : "Collection";
  const accountId = String(formData.get(field) ?? "").trim();
  try {
    if (accountId && !/^acct_[A-Za-z0-9]+$/.test(accountId)) throw new Error("Enter a Stripe account id that starts with acct_.");
    if (accountId) {
      const { stripeCredentials, stripeGet } = await import("@/lib/stripe-admin");
      const creds = await stripeCredentials();
      if (!creds.ok) throw new Error("Connect Stripe first. Nothing was saved.");
      const read = await stripeGet(`/v1/accounts/${accountId}`, creds.secret);
      if (!read.ok) throw new Error(`Stripe did not find that connected account: ${read.error} Nothing was saved.`);
    }
    const { prisma } = await import("@/lib/db");
    const before = await prisma.marketplaceSettings.findUnique({ where: { id: "default" } });
    await prisma.marketplaceSettings.upsert({
      where: { id: "default" },
      update: { [field]: accountId },
      create: { id: "default", reviewWindowHours: 72, [field]: accountId },
    });
    await prisma.auditLog.create({
      data: {
        actor: session.email,
        action: `${role}_stripe_account.saved`,
        objectType: "MarketplaceSettings",
        objectId: "default",
        before: { [field]: before?.[field] ?? "" },
        after: { [field]: accountId },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : `Could not save the ${label} account.`;
    redirect(`/admin/payment-settings?section=roles&error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/payment-settings");
  redirect(`/admin/payment-settings?section=roles&saved=${role}-account`);
}
