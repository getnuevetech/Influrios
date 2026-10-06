"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { assertLegacyDemoPayments } from "@/lib/legacy-demo-payments";
import {
  advanceDispute,
  attachContractToDeal,
  createContractBrief,
  type DisputeStatus,
} from "@/lib/trust";

const RESOLUTIONS: DisputeStatus[] = [
  "under_review",
  "resolved_release",
  "resolved_refund",
  "resolved_partial",
  "withdrawn",
];

export async function actionAdvanceDispute(formData: FormData) {
  await assertLegacyDemoPayments();
  await requireAdminAction("trust.mediate");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as DisputeStatus;
  const note = String(formData.get("note") ?? "") || undefined;
  if (!RESOLUTIONS.includes(status)) {
    redirect("/admin/trust?error=invalid_status");
  }
  try {
    await advanceDispute(id, status, note);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "advance_failed";
    redirect(`/admin/trust?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/admin/trust");
  revalidatePath("/trust");
  revalidatePath("/payments");
  revalidatePath("/admin/payments");
  redirect(`/admin/trust?advanced=${id}`);
}

export async function actionCreateContract(formData: FormData) {
  await assertLegacyDemoPayments();
  await requireAdminAction("trust.mediate");
  const title = String(formData.get("title") ?? "").trim();
  const audience = String(formData.get("audience") ?? "both") as
    | "creator"
    | "business"
    | "both";
  const summary = String(formData.get("summary") ?? "").trim();
  const clauses = String(formData.get("clauses") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const linkedDealId = String(formData.get("linkedDealId") ?? "").trim() || undefined;

  try {
    await createContractBrief({ title, audience, summary, clauses, linkedDealId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create_failed";
    redirect(`/admin/trust?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/admin/trust");
  revalidatePath("/trust");
  redirect("/admin/trust?contract=1");
}

export async function actionAttachContract(formData: FormData) {
  await assertLegacyDemoPayments();
  await requireAdminAction("trust.mediate");
  const contractId = String(formData.get("contractId") ?? "");
  const dealId = String(formData.get("dealId") ?? "");
  try {
    await attachContractToDeal(contractId, dealId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "attach_failed";
    redirect(`/admin/trust?error=${encodeURIComponent(msg)}`);
  }
  revalidatePath("/admin/trust");
  revalidatePath("/trust");
  redirect(`/admin/trust?attached=${contractId}`);
}
