"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminAction } from "@/app/admin/guard";
import {
  addBannerImage,
  removeBannerImage,
  saveBannerUpload,
  updateBanner,
  updateFeaturedCardsConfig,
  updateManagedCard,
  type BannerSlot,
  type CardFeatureFlags,
} from "@/lib/cms";

export async function actionUpdateBanner(formData: FormData) {
  await requireAdminAction("banners.edit");
  const id = String(formData.get("id")) as BannerSlot;
  await updateBanner(id, {
    enabled: formData.get("enabled") === "on",
    heightScale: Number(formData.get("heightScale") || 1),
    title: String(formData.get("title") ?? ""),
    subtitle: String(formData.get("subtitle") ?? ""),
    ctaLabel: String(formData.get("ctaLabel") ?? ""),
    ctaHref: String(formData.get("ctaHref") ?? ""),
  });
  revalidatePath("/");
  revalidatePath("/admin");
  redirect(`/admin/banners?saved=${id}`);
}

export async function actionUploadBannerImage(formData: FormData) {
  await requireAdminAction("banners.edit");
  const id = String(formData.get("id")) as BannerSlot;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/admin/banners?error=nofile`);
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const url = await saveBannerUpload(file.name, bytes);
  await addBannerImage(id, url);
  revalidatePath("/");
  revalidatePath("/admin");
  redirect(`/admin/banners?uploaded=${id}`);
}

export async function actionRemoveBannerImage(formData: FormData) {
  await requireAdminAction("banners.edit");
  const id = String(formData.get("id")) as BannerSlot;
  const image = String(formData.get("image") ?? "");
  await removeBannerImage(id, image);
  revalidatePath("/");
  revalidatePath("/admin");
  redirect(`/admin/banners?removed=${id}`);
}

export async function actionUpdateFeaturedGlobals(formData: FormData) {
  await requireAdminAction("cards.edit");
  await updateFeaturedCardsConfig({
    widthScale: Number(formData.get("widthScale") || 1.2),
    socialIconSize: Number(formData.get("socialIconSize") || 22),
    qrSize: Number(formData.get("qrSize") || 22),
  });
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin/cards?saved=globals");
}

export async function actionUpdateCard(formData: FormData) {
  await requireAdminAction("cards.edit");
  const slug = String(formData.get("slug") ?? "");
  const features: CardFeatureFlags = {
    showBadge: formData.get("showBadge") === "on",
    showHeart: formData.get("showHeart") === "on",
    showVerified: formData.get("showVerified") === "on",
    showLocation: formData.get("showLocation") === "on",
    showSpecialties: formData.get("showSpecialties") === "on",
    showSocials: formData.get("showSocials") === "on",
    showFollowerCounts: formData.get("showFollowerCounts") === "on",
    showQr: formData.get("showQr") === "on",
    showStatus: formData.get("showStatus") === "on",
    visiblePlatforms: String(formData.get("visiblePlatforms") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
  await updateManagedCard(slug, {
    visible: formData.get("visible") === "on",
    order: Number(formData.get("order") || 0),
    features,
  });
  revalidatePath("/");
  revalidatePath("/admin");
  redirect(`/admin/cards?saved=${slug}`);
}
