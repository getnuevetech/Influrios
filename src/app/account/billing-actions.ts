"use server";

import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { setSubscriptionAutoRenew } from "@/lib/subscription-renewal-run";

export async function actionSetAutoRenew(formData: FormData) {
  const session = await getAccountSession();
  if (!session) redirect("/login?next=/account%3Ftab%3Dbilling");
  const requested = String(formData.get("autoRenew") ?? "");
  if (requested !== "on" && requested !== "off") {
    redirect("/account?tab=billing&error=" + encodeURIComponent("Choose auto-renewal on or off. Nothing was changed."));
  }
  const result = await setSubscriptionAutoRenew({ userId: session.id, turnOn: requested === "on" });
  if (!result.ok) {
    redirect(`/account?tab=billing&error=${encodeURIComponent(result.error)}`);
  }
  redirect("/account?tab=billing&saved=1");
}
