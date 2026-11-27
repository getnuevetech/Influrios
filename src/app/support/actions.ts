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
  redirect(`/support/tickets/${result.id}?t=${encodeURIComponent(result.token)}&opened=1`);
}

async function requester(formData: FormData) {
  const account = await getAccountSession().catch(() => null);
  return {
    id: String(formData.get("ticketId") ?? ""),
    token: String(formData.get("t") ?? "") || null,
    userId: account?.id ?? null,
    email: account?.email ?? null,
  };
}

function ticketPath(id: string, token: string | null, query: string) {
  return `/support/tickets/${id}?${token ? `t=${encodeURIComponent(token)}&` : ""}${query}`;
}

export async function actionReplyToTicket(formData: FormData) {
  const who = await requester(formData);
  const { addMemberReply } = await import("@/lib/support-tickets");
  const result = await addMemberReply({ ...who, body: String(formData.get("body") ?? "") });
  if (!result.ok) redirect(ticketPath(who.id, who.token, `error=${encodeURIComponent(result.error)}`));
  redirect(ticketPath(who.id, who.token, "replied=1"));
}

export async function actionResolveTicket(formData: FormData) {
  const who = await requester(formData);
  const { memberResolveTicket } = await import("@/lib/support-tickets");
  const result = await memberResolveTicket(who);
  if (!result.ok) redirect(ticketPath(who.id, who.token, `error=${encodeURIComponent(result.error)}`));
  redirect(ticketPath(who.id, who.token, "resolved=1"));
}
