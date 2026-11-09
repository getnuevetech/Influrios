"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession, hasPermission, isSuperAdmin } from "@/lib/admin-auth";
import { approveContractAmendment, voidContractDocument } from "@/lib/signed-funding-apply";

function dollarsToCents(raw: string) {
  const amount = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

async function operator() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

export async function actionVoidDealContract(formData: FormData) {
  const session = await operator();
  const id = String(formData.get("id") ?? "").trim();
  if (!isSuperAdmin(session)) {
    redirect(`/admin/deals/${id}?error=` + encodeURIComponent("Only a super admin can void an agreement."));
  }
  const result = await voidContractDocument({
    id,
    actor: session.email,
    reason: String(formData.get("reason") ?? ""),
  });
  if (!result.ok) redirect(`/admin/deals/${id}?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/admin/contracts");
  revalidatePath(`/admin/deals/${id}`);
  redirect(`/admin/deals/${id}?voided=1`);
}

export async function actionApproveDealAmendment(formData: FormData) {
  const session = await operator();
  const id = String(formData.get("id") ?? "").trim();
  if (!isSuperAdmin(session) && !hasPermission(session, "contracts.manage")) {
    redirect(`/admin/deals/${id}?error=` + encodeURIComponent("A contract manager or super admin approves a change order."));
  }
  const creators = String(formData.get("creators") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [slug, share] = line.split(",").map((part) => part.trim());
      return { slug, shareBps: Math.round(Number(share) * 100) };
    });
  const milestones = String(formData.get("milestones") ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, share] = line.split("|").map((part) => part.trim());
      return { title, shareBps: Math.round(Number(share) * 100) };
    });
  const result = await approveContractAmendment({
    documentId: id,
    actor: session.email,
    note: String(formData.get("note") ?? ""),
    grossCents: dollarsToCents(String(formData.get("gross") ?? "")),
    currency: String(formData.get("currency") ?? ""),
    creators,
    milestones,
  });
  if (!result.ok) redirect(`/admin/deals/${id}?error=${encodeURIComponent(result.error)}`);
  revalidatePath(`/admin/deals/${id}`);
  redirect(`/admin/deals/${id}?amended=1`);
}
