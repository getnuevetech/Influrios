"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { staffAssign, staffNote, staffReply, staffSetStatus } from "@/lib/support-tickets";

const back = (id: string, query: string) => `/admin/support/${encodeURIComponent(id)}?${query}`;

function done(id: string, query: string): never {
  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${id}`);
  redirect(back(id, query));
}

export async function actionStaffReply(formData: FormData) {
  const session = await requireAdminAction("accounts.edit");
  const id = String(formData.get("ticketId") ?? "");
  const result = await staffReply({
    id,
    staffEmail: session.email,
    staffName: session.name,
    body: String(formData.get("body") ?? ""),
    status: String(formData.get("status") ?? "waiting_on_member"),
  });
  if (!result.ok) redirect(back(id, `error=${encodeURIComponent(result.error)}`));
  done(id, result.emailed ? "replied=1" : "replied=1&unsent=1");
}

export async function actionStaffNote(formData: FormData) {
  const session = await requireAdminAction("accounts.edit");
  const id = String(formData.get("ticketId") ?? "");
  const result = await staffNote({ id, staffEmail: session.email, staffName: session.name, body: String(formData.get("body") ?? "") });
  if (!result.ok) redirect(back(id, `error=${encodeURIComponent(result.error)}`));
  done(id, "noted=1");
}

export async function actionStaffStatus(formData: FormData) {
  const session = await requireAdminAction("accounts.edit");
  const id = String(formData.get("ticketId") ?? "");
  const result = await staffSetStatus({ id, staffEmail: session.email, status: String(formData.get("status") ?? "") });
  if (!result.ok) redirect(back(id, `error=${encodeURIComponent(result.error)}`));
  done(id, "status=1");
}

export async function actionStaffAssign(formData: FormData) {
  const session = await requireAdminAction("accounts.edit");
  const id = String(formData.get("ticketId") ?? "");
  const assignee = formData.get("assignee") === "me" ? session.email : "";
  await staffAssign({ id, staffEmail: session.email, assignee });
  done(id, "assigned=1");
}
