"use server";

import { redirect } from "next/navigation";
import { declineInvitation } from "@/lib/invitations";

export async function actionDeclineInvitation(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (token) await declineInvitation(token).catch(() => null);
  redirect(token ? `/invite/${token}` : "/claim");
}
