"use server";

import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import {
  updateHomepageCategories,
  updateHomepageCollaboration,
  type HomepageCategoryItem,
  type HomepageCollabMatch,
} from "@/lib/cms";
import { updateHomepageSection, updateMenuItem } from "@/lib/directory";
import { normalizeInfluencerRoleTitle } from "@/lib/terminology-copy";

export async function actionUpdateSection(formData: FormData) {
  const session = await requireAdminAction("banners.edit");
  const status = String(formData.get("status") ?? "published");
  try {
    await updateHomepageSection({
      actor: session.email,
      key: String(formData.get("key") ?? ""),
      sortOrder: Number(formData.get("sortOrder") ?? 0),
      enabled: formData.get("enabled") === "true",
      status: status === "draft" ? "draft" : "published",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save section";
    redirect(`/admin/homepage?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/homepage?saved=1");
}

export async function actionUpdateMenu(formData: FormData) {
  const session = await requireAdminAction("banners.edit");
  try {
    await updateMenuItem({
      actor: session.email,
      id: String(formData.get("id") ?? ""),
      label: String(formData.get("label") ?? "").trim(),
      href: String(formData.get("href") ?? "").trim(),
      sortOrder: Number(formData.get("sortOrder") ?? 0),
      visible: formData.get("visible") === "true",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save menu";
    redirect(`/admin/homepage?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/homepage?saved=1");
}

export async function actionSaveHomepageCategories(formData: FormData) {
  await requireAdminAction("banners.edit");
  const slugs = formData.getAll("slug").map(String);
  const images = formData.getAll("image").map(String);
  const items: HomepageCategoryItem[] = slugs
    .map((slug, index) => ({
      slug: slug.trim(),
      image: (images[index] ?? "").trim(),
    }))
    .filter((item) => item.slug && item.image);
  try {
    await updateHomepageCategories({
      title: String(formData.get("title") ?? "").trim(),
      ctaLabel: String(formData.get("ctaLabel") ?? "").trim(),
      ctaHref: String(formData.get("ctaHref") ?? "").trim(),
      items,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save categories";
    redirect(`/admin/homepage?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/homepage?saved=categories");
}

export async function actionSaveHomepageCollaboration(formData: FormData) {
  await requireAdminAction("banners.edit");
  const titles = formData.getAll("matchTitle").map(String);
  const leftSlugs = formData.getAll("leftSlug").map(String);
  const rightSlugs = formData.getAll("rightSlug").map(String);
  const tagsRaw = formData.getAll("tags").map(String);
  const images = formData.getAll("matchImage").map(String);
  const matches: HomepageCollabMatch[] = titles
    .map((title, index) => ({
      title: normalizeInfluencerRoleTitle(title.trim()),
      leftSlug: (leftSlugs[index] ?? "").trim(),
      rightSlug: (rightSlugs[index] ?? "").trim(),
      tags: (tagsRaw[index] ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      image: (images[index] ?? "").trim() || undefined,
    }))
    .filter((item) => item.title && item.leftSlug && item.rightSlug);
  try {
    await updateHomepageCollaboration({
      title: String(formData.get("title") ?? "").trim(),
      subtitle: String(formData.get("subtitle") ?? "").trim(),
      ctaLabel: String(formData.get("ctaLabel") ?? "").trim(),
      ctaHref: String(formData.get("ctaHref") ?? "").trim(),
      matches,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save collaboration matches";
    redirect(`/admin/homepage?error=${encodeURIComponent(message)}`);
  }
  redirect("/admin/homepage?saved=collaboration");
}
