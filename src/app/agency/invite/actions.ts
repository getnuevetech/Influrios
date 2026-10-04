"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { acceptAgencySeatInvite } from "@/lib/agency-seats";

export async function actionAcceptAgencySeatInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) redirect("/agency?error=" + encodeURIComponent("Missing invite token."));
  const account = await getAccountSession();
  if (!account) {
    redirect(`/login?next=${encodeURIComponent(`/agency/invite/${token}`)}`);
  }
  const result = await acceptAgencySeatInvite({
    token,
    accountEmail: account.email,
    accountUserId: account.id,
  });
  if (!result.ok) {
    redirect(`/agency/invite/${token}?error=${encodeURIComponent(result.error)}`);
  }
  revalidatePath("/agency");
  revalidatePath("/admin/agency");
  redirect("/agency?seat=accepted");
}
