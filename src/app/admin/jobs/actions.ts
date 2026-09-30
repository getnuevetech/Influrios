"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { retryFailedJob } from "@/lib/jobs";

export async function actionRetryJob(formData: FormData) {
  await requireAdminAction("jobs.retry");
  const id = String(formData.get("id") ?? "").trim();
  if (id) await retryFailedJob(id);
  revalidatePath("/admin/jobs");
  redirect("/admin/jobs?retried=1");
}
