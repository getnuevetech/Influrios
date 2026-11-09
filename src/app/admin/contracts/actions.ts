"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { getAdminSession, isSuperAdmin } from "@/lib/admin-auth";
import { deleteContractDocumentAsSuperAdmin, saveContractTemplate } from "@/lib/contract-document";
import { voidContractDocument } from "@/lib/signed-funding-apply";

export async function actionSaveContractTemplate(formData: FormData) {
  await requireAdminAction("contracts.templates");
  const result = await saveContractTemplate(String(formData.get("body") ?? ""));
  if (!result.ok) {
    redirect(`/admin/contracts?error=${encodeURIComponent(result.error)}`);
  }
  revalidatePath("/admin/contracts");
  redirect("/admin/contracts?saved=1");
}

export async function actionDeleteContractDocument(formData: FormData) {
  const session = await getAdminSession();
  if (!session || !isSuperAdmin(session)) {
    redirect(
      "/admin/contracts?error=" +
        encodeURIComponent("Only a super admin can delete a contract. Ask a super admin if this agreement was created twice."),
    );
  }
  if (formData.get("confirm") !== "on") {
    redirect("/admin/contracts?error=" + encodeURIComponent("Confirm the deletion. Nothing was deleted."));
  }
  const result = await deleteContractDocumentAsSuperAdmin(String(formData.get("id") ?? ""));
  if (!result.ok) {
    redirect(`/admin/contracts?error=${encodeURIComponent(result.error)}`);
  }
  revalidatePath("/admin/contracts");
  revalidatePath("/collaboration/contracts");
  redirect("/admin/contracts?deleted=1");
}

export async function actionVoidContractDocument(formData: FormData) {
  const session = await getAdminSession();
  if (!session || !isSuperAdmin(session)) {
    redirect(
      "/admin/contracts?error=" +
        encodeURIComponent("Only a super admin can void a contract. Ask a super admin if this agreement was created twice."),
    );
  }
  const id = String(formData.get("id") ?? "").trim();
  const result = await voidContractDocument({
    id,
    actor: session.email,
    reason: String(formData.get("reason") ?? ""),
  });
  if (!result.ok) redirect(`/admin/contracts?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/admin/contracts");
  revalidatePath(`/admin/deals/${id}`);
  redirect("/admin/contracts?voided=1");
}
