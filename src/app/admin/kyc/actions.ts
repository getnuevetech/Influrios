"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { addKycRequirement, removeKycRequirement, reviewDocumentKyc, saveKycGateway } from "@/lib/kyc-document";

export async function actionSaveKycGateway(formData: FormData) {
  await requireAdminAction("collab_finance.manage");
  try {
    await saveKycGateway(String(formData.get("gatewayProviderId") ?? ""));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the KYC gateway.";
    redirect(`/admin/kyc?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/kyc");
  revalidatePath("/dashboard/kyc");
  redirect("/admin/kyc?saved=gateway");
}

export async function actionAddKycRequirement(formData: FormData) {
  await requireAdminAction("collab_finance.manage");
  try {
    await addKycRequirement({
      kind: String(formData.get("kind") ?? ""),
      label: String(formData.get("label") ?? ""),
      required: String(formData.get("required") ?? "") === "1",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add that requirement.";
    redirect(`/admin/kyc?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/kyc");
  revalidatePath("/dashboard/kyc");
  redirect("/admin/kyc?saved=requirement");
}

export async function actionRemoveKycRequirement(formData: FormData) {
  await requireAdminAction("collab_finance.manage");
  try {
    await removeKycRequirement(String(formData.get("id") ?? ""));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove that requirement.";
    redirect(`/admin/kyc?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/kyc");
  revalidatePath("/dashboard/kyc");
  redirect("/admin/kyc?saved=removed");
}

export async function actionReviewDocumentKyc(formData: FormData) {
  await requireAdminAction("collab_finance.manage");
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "verified" && decision !== "rejected") {
    redirect("/admin/kyc?error=Choose%20verified%20or%20rejected.");
  }
  try {
    await reviewDocumentKyc({ submissionId: String(formData.get("submissionId") ?? ""), decision });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not review that KYC submission.";
    redirect(`/admin/kyc?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/kyc");
  revalidatePath("/dashboard/kyc");
  redirect(`/admin/kyc?saved=${decision}`);
}
