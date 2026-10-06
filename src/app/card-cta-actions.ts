"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { recordCreatorCtaClick } from "@/lib/short-link";

export async function actionRecordCardCta(formData: FormData) {
  const slug = String(formData.get("slug") ?? "").trim().slice(0, 80);
  if (!slug) redirect("/");
  const h = await headers();
  await recordCreatorCtaClick(slug, {
    userAgent: h.get("user-agent"),
    referrer: h.get("referer"),
  });
  redirect(`/creators/${slug}`);
}
