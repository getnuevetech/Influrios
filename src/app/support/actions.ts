"use server";

import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { sendSupportMessage } from "@/lib/support";

export async function actionSendSupportMessage(formData: FormData) {
  const account = await getAccountSession().catch(() => null);
  const text = (name: string) => String(formData.get(name) ?? "");
  const result = await sendSupportMessage({
    name: text("name"),
    email: text("email"),
    topic: text("topic"),
    message: text("message"),
    reference: text("reference"),
    website: text("website"),
    accountId: account?.id ?? null,
  });
  if (!result.ok) {
    // Bots that fill the hidden field see the same thanks page and nothing is sent.
    if (result.error === "spam") redirect("/support?sent=1");
    const keep = new URLSearchParams({ error: result.error, topic: text("topic"), ref: text("reference") });
    redirect(`/support?${keep.toString()}`);
  }
  redirect(`/support?sent=1&ticket=${encodeURIComponent(result.ticket)}`);
}
