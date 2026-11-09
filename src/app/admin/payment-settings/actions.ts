"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { saveCanonicalCountryRoute } from "@/lib/canonical-country-route";
import { recordProviderStagingTraces, saveDeferredFundingSwitches, saveLaunchApprovals } from "@/lib/launch-gate";

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
    redirect(`/admin/payment-settings?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/payment-settings");
  revalidatePath("/admin/corridors");
  revalidatePath("/admin/gateways");
  revalidatePath("/admin/marketplace/settings");
  redirect(`/admin/payment-settings?saved=${encodeURIComponent(countryCode.trim().toUpperCase())}`);
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
    redirect(`/admin/payment-settings?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/payment-settings");
  redirect("/admin/payment-settings?saved=launch-approvals");
}

export async function actionSaveDeferredFunding(formData: FormData) {
  const session = await requireAdminAction("marketplace.manage");
  try {
    await saveDeferredFundingSwitches({
      actor: session.email,
      reason: String(formData.get("reason") ?? ""),
      switches: {
        crossBorderFundingEnabled: formData.get("crossBorderFundingEnabled") === "on",
        teamFundingEnabled: formData.get("teamFundingEnabled") === "on",
        stagedFundingEnabled: formData.get("stagedFundingEnabled") === "on",
        automaticMilestoneApprovalEnabled: formData.get("automaticMilestoneApprovalEnabled") === "on",
        automaticProviderSwitchingEnabled: formData.get("automaticProviderSwitchingEnabled") === "on",
        allInBudgetEntryEnabled: formData.get("allInBudgetEntryEnabled") === "on",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the funding switches.";
    redirect(`/admin/payment-settings?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/payment-settings");
  redirect("/admin/payment-settings?saved=funding-switches");
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
    redirect(`/admin/payment-settings?error=${encodeURIComponent("Trace amounts must be whole minor units.")}`);
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
    const message = error instanceof Error ? error.message : "The staging trace was not recorded.";
    redirect(`/admin/payment-settings?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/payment-settings");
  redirect("/admin/payment-settings?saved=provider-trace");
}
