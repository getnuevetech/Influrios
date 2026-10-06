"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertLegacyDemoPayments } from "@/lib/legacy-demo-payments";
import { openDispute, type DisputeOpenedBy } from "@/lib/trust";

export async function actionOpenDispute(formData: FormData) {
  await assertLegacyDemoPayments();
  const selection = String(formData.get("selection") ?? "");
  let dealId = String(formData.get("dealId") ?? "");
  let milestoneId = String(formData.get("milestoneId") ?? "");
  if (selection.includes("::")) {
    const [d, m] = selection.split("::");
    dealId = d;
    milestoneId = m;
  }
  const openedBy = String(formData.get("openedBy") ?? "business") as DisputeOpenedBy;
  const reason = String(formData.get("reason") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();

  if (!dealId || !milestoneId || !reason) {
    redirect("/trust?error=missing_fields");
  }

  let id = "";
  try {
    const d = await openDispute({
      dealId,
      milestoneId,
      openedBy: ["business", "creator", "ops"].includes(openedBy)
        ? openedBy
        : "business",
      reason,
      details,
    });
    id = d.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "open_failed";
    redirect(`/trust?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/trust");
  revalidatePath("/admin/trust");
  revalidatePath("/payments");
  revalidatePath("/admin/payments");
  redirect(`/trust?opened=${id}`);
}
