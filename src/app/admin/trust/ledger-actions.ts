"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { addDisputeEvidence, decideMilestoneDispute, type DisputeDecision } from "@/lib/milestone-disputes";

const ACTIONS: DisputeDecision[] = ["review", "release", "refund", "partial", "withdraw"];

export async function actionAddLedgerEvidence(formData: FormData) {
  await requireAdminAction("trust.mediate");
  const result = await addDisputeEvidence({
    disputeId: String(formData.get("disputeId") ?? ""),
    author: "ops",
    body: String(formData.get("body") ?? ""),
    url: String(formData.get("url") ?? ""),
  });
  if (!result.ok) redirect(`/admin/trust?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/admin/trust");
  revalidatePath("/payments");
  revalidatePath("/dashboard");
  redirect("/admin/trust?evidence=1");
}

export async function actionDecideLedgerDispute(formData: FormData) {
  const session = await requireAdminAction("trust.mediate");
  const disputeId = String(formData.get("disputeId") ?? "");
  const action = String(formData.get("decision") ?? "") as DisputeDecision;
  if (!ACTIONS.includes(action)) redirect("/admin/trust?error=Choose a decision.");
  const result = await decideMilestoneDispute({
    disputeId,
    action,
    requestedCents: Math.round(Number(formData.get("requestedUsd") ?? 0) * 100),
    note: String(formData.get("note") ?? ""),
    actor: session.email,
  });
  if (!result.ok) redirect(`/admin/trust?error=${encodeURIComponent(result.error)}`);
  revalidatePath("/admin/trust");
  revalidatePath("/payments");
  revalidatePath("/trust");
  redirect(`/admin/trust?advanced=${result.status}`);
}
