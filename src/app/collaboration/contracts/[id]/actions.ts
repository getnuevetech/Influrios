"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { getAdminSession } from "@/lib/admin-auth";
import { isMessageAudience, postContractMessage, signNativeContractParty } from "@/lib/contract-document";
import { prisma } from "@/lib/db";

export async function actionSignNativeContract(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "").trim();
  const account = await getAccountSession().catch(() => null);
  if (!account) {
    redirect(`/login?next=${encodeURIComponent(`/collaboration/contracts/${documentId}`)}`);
  }
  const agreed = formData.get("agree") === "on" || formData.get("agree") === "1";
  if (!agreed) {
    redirect(
      `/collaboration/contracts/${documentId}?error=${encodeURIComponent("Confirm that you agree before signing.")}`,
    );
  }
  const result = await signNativeContractParty({
    documentId,
    userId: account.id,
    typedName: String(formData.get("typedName") ?? ""),
  });
  if (!result.ok) {
    redirect(`/collaboration/contracts/${documentId}?error=${encodeURIComponent(result.error)}`);
  }
  revalidatePath(`/collaboration/contracts/${documentId}`);
  revalidatePath("/account");
  revalidatePath("/collaboration/contract");
  const signed = result.status === "signed" ? "1" : "0";
  redirect(`/collaboration/contracts/${documentId}?signed=${signed}`);
}

export async function actionPostContractMessage(formData: FormData) {
  const documentId = String(formData.get("documentId") ?? "").trim();
  const audienceRaw = String(formData.get("audience") ?? "");
  if (!isMessageAudience(audienceRaw)) {
    redirect(`/collaboration/contracts/${documentId}?error=${encodeURIComponent("Choose who can read this message.")}`);
  }
  const account = await getAccountSession().catch(() => null);
  const admin = await getAdminSession().catch(() => null);
  const parties = await prisma.contractParty.findMany({ where: { documentId } });
  const party = account ? parties.find((row) => row.userId === account.id) : undefined;
  const result = await postContractMessage({
    documentId,
    body: String(formData.get("body") ?? ""),
    audience: audienceRaw,
    recipientPartyId: String(formData.get("recipientPartyId") ?? ""),
    senderName: party?.name || admin?.name || account?.name || "Influrios",
    senderUserId: party ? account?.id : null,
    senderAdminId: party ? null : admin?.userId,
    viewerPartyId: party?.id,
    admin: admin ? { roleId: admin.roleId, permissions: admin.permissions } : null,
  });
  if (!result.ok) {
    redirect(`/collaboration/contracts/${documentId}?error=${encodeURIComponent(result.error)}`);
  }
  revalidatePath(`/collaboration/contracts/${documentId}`);
  redirect(`/collaboration/contracts/${documentId}?sent=1`);
}
