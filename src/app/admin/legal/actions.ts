"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import { hashLegalBody } from "@/lib/legal";
import { prisma } from "@/lib/db";

function clean(value: FormDataEntryValue | null, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

export async function actionPublishLegalVersion(formData: FormData) {
  const session = await requireAdminAction("legal.edit");
  const documentKey = clean(formData.get("documentKey"), 80).toLowerCase().replace(/[^a-z0-9-]/g, "");
  const title = clean(formData.get("title"), 180);
  const version = clean(formData.get("version"), 40);
  const bodyText = clean(formData.get("bodyText"), 200_000);
  const featureTrigger = clean(formData.get("featureTrigger"), 60) || "public";
  const category = clean(formData.get("category"), 40) || "core";
  const effective = clean(formData.get("effectiveDate"), 20);
  if (!documentKey || !title || !version || !bodyText || !/^\d{4}-\d{2}-\d{2}$/.test(effective)) {
    redirect("/admin/legal?error=Title%2C%20version%2C%20date%2C%20and%20body%20are%20required");
  }
  const previous = await prisma.legalDocument.findFirst({
    where: { documentKey, publishedStatus: "published" },
    orderBy: { effectiveDate: "desc" },
  });
  let created;
  try {
    created = await prisma.legalDocument.create({
    data: {
      documentKey,
      title,
      version,
      effectiveDate: new Date(`${effective}T00:00:00.000Z`),
      featureTrigger,
      category,
      roleScope: clean(formData.get("roleScope"), 40) || "all",
      jurisdiction: clean(formData.get("jurisdiction"), 40) || "global",
      requiresAcceptance: formData.get("requiresAcceptance") === "on",
      acknowledgementOnly: formData.get("acknowledgementOnly") === "on",
      requiresReacceptance: formData.get("requiresReacceptance") === "on",
      publishedStatus: "published",
      bodyText,
      documentHash: hashLegalBody(bodyText),
      supersedesId: previous?.id,
      publishedAt: new Date(),
      createdBy: session.email,
    },
  });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      redirect("/admin/legal?error=That%20version%20already%20exists");
    }
    throw error;
  }
  if (previous) {
    await prisma.legalDocument.update({
      where: { id: previous.id },
      data: { publishedStatus: "superseded" },
    });
  }
  revalidatePath("/admin/legal");
  revalidatePath("/legal");
  revalidatePath(`/legal/${created.documentKey}`);
  redirect("/admin/legal?saved=1");
}

export async function actionSetLegalStatus(formData: FormData) {
  await requireAdminAction("legal.edit");
  const id = clean(formData.get("id"), 80);
  const status = clean(formData.get("status"), 40);
  if (!id || !["disabled", "archived", "published", "draft"].includes(status)) {
    redirect("/admin/legal?error=Unknown%20status");
  }
  await prisma.legalDocument.update({
    where: { id },
    data: { publishedStatus: status, publishedAt: status === "published" ? new Date() : undefined },
  });
  revalidatePath("/admin/legal");
  revalidatePath("/legal");
  redirect("/admin/legal?saved=1");
}

export async function actionSetReacceptance(formData: FormData) {
  await requireAdminAction("legal.edit");
  const id = clean(formData.get("id"), 80);
  const doc = await prisma.legalDocument.findUnique({ where: { id } });
  if (!doc) redirect("/admin/legal?error=Missing%20document");
  await prisma.legalDocument.update({
    where: { id },
    data: { requiresReacceptance: !doc.requiresReacceptance },
  });
  revalidatePath("/admin/legal");
  redirect("/admin/legal?saved=1");
}
