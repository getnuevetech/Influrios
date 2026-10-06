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

export async function actionUpdateValueProposition(formData: FormData) {
  await requireAdminAction("banners.edit");
  const { updateValueProposition } = await import("@/lib/cms");
  const keys = formData.getAll("itemKey").map(String);
  const items = keys.map((key, i) => ({
    key,
    enabled: formData.get(`enabled_${key}`) === "on",
    sortOrder: Number(formData.get(`sort_${key}`) || i),
    iconKey: String(formData.get(`icon_${key}`) || "card") as
      | "card"
      | "intelligence"
      | "network"
      | "payments",
    title: String(formData.get(`title_${key}`) ?? ""),
    description: String(formData.get(`desc_${key}`) ?? ""),
    microLabel: String(formData.get(`micro_${key}`) ?? ""),
    linkUrl: String(formData.get(`link_${key}`) ?? "/"),
    accentToken: String(formData.get(`accent_${key}`) || "violet") as
      | "violet"
      | "blue"
      | "rose"
      | "emerald",
  }));
  await updateValueProposition({
    enabled: formData.get("enabled") === "on",
    eyebrow: String(formData.get("eyebrow") ?? ""),
    headline: String(formData.get("headline") ?? ""),
    headlineHighlight: String(formData.get("headlineHighlight") ?? ""),
    subtitle: String(formData.get("subtitle") ?? ""),
    closingTaglineLine1: String(formData.get("closing1") ?? ""),
    closingTaglineLine2: String(formData.get("closing2") ?? ""),
    items,
  });
  revalidatePath("/");
  revalidatePath("/admin/value-prop");
  redirect("/admin/value-prop?saved=1");
}

export async function actionRestoreValueProposition() {
  await requireAdminAction("banners.edit");
  const { restoreDefaultValueProposition } = await import("@/lib/cms");
  await restoreDefaultValueProposition();
  revalidatePath("/");
  revalidatePath("/admin/value-prop");
  redirect("/admin/value-prop?restored=1");
}

export async function actionSimulateFee(formData: FormData) {
  await requireAdminAction("commerce.view");
  const jurisdiction = String(formData.get("jurisdiction") || "US");
  const serviceLevel = String(formData.get("serviceLevel") || "contracted");
  const gross = Math.round(Number(formData.get("grossUsd") || 0) * 100);
  const { resolveFee } = await import("@/lib/collaboration-fees");
  const result = await resolveFee({
    jurisdiction,
    serviceLevel,
    grossValueCents: gross,
  });
  const q = new URLSearchParams({
    simulated: "1",
    jurisdiction,
    serviceLevel,
    grossUsd: String(formData.get("grossUsd") || "0"),
    feeCents: String(result.feeCents),
    rule: result.rule?.name ?? "none",
    feeType: result.rule?.feeType ?? "",
    explanation: result.explanation.slice(0, 400),
  });
  redirect(`/admin/fees?${q.toString()}`);
}

export async function actionFreezeFeeSnapshot(formData: FormData) {
  await requireAdminAction("commerce.manage");
  const jurisdiction = String(formData.get("jurisdiction") || "US");
  const serviceLevel = String(formData.get("serviceLevel") || "contracted");
  const gross = Math.round(Number(formData.get("grossUsd") || 0) * 100);
  const { createFeeSnapshot } = await import("@/lib/collaboration-fees");
  const snap = await createFeeSnapshot({
    jurisdiction,
    serviceLevel,
    grossValueCents: gross,
  });
  revalidatePath("/admin/fees");
  redirect(`/admin/fees?frozen=${snap.id}`);
}

export async function actionSaveFeeRule(formData: FormData) {
  await requireAdminAction("commerce.manage");
  const { parseTierBands, upsertFeeRule } = await import("@/lib/collaboration-fees");
  let tierBands: ReturnType<typeof parseTierBands> = [];
  const rawBands = String(formData.get("tierBandsJson") || "").trim();
  if (rawBands) {
    try {
      tierBands = parseTierBands(JSON.parse(rawBands));
    } catch {
      redirect(`/admin/fees?error=${encodeURIComponent("Tier bands JSON is invalid.")}`);
    }
  }
  try {
    await upsertFeeRule({
      id: String(formData.get("id") || "") || undefined,
      name: String(formData.get("name") || "Untitled rule"),
      active: formData.get("active") === "on",
      priority: Number(formData.get("priority") || 100),
      jurisdiction: String(formData.get("jurisdiction") || "*"),
      serviceLevel: String(formData.get("serviceLevel") || "contracted"),
      feeType: String(formData.get("feeType") || "collaboration") as
        | "platform_service"
        | "collaboration"
        | "managed_intro"
        | "managed_campaign"
        | "success"
        | "processing"
        | "fx"
        | "cancellation_dispute"
        | "referral",
      fundingMode: String(formData.get("fundingMode") || "*"),
      relationshipSource: String(formData.get("relationshipSource") || "*"),
      promotionChannel: String(formData.get("promotionChannel") || "*"),
      method: String(formData.get("method") || "percent") as
        | "percent"
        | "fixed"
        | "percent_plus_fixed"
        | "waived"
        | "tiered"
        | "custom_enterprise",
      percentBps: Number(formData.get("percentBps") || 0),
      fixedCents: Math.round(Number(formData.get("fixedUsd") || 0) * 100),
      minFeeCents: Math.round(Number(formData.get("minFeeUsd") || 0) * 100),
      maxFeeCents: formData.get("maxFeeUsd")
        ? Math.round(Number(formData.get("maxFeeUsd")) * 100)
        : null,
      tierBands,
      payer: String(formData.get("payer") || "brand") as "brand" | "creator" | "split",
      notes: String(formData.get("notes") || ""),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the fee rule.";
    redirect(`/admin/fees?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/fees");
  redirect("/admin/fees?saved=rule");
}

export async function actionSaveJurisdictionGate(formData: FormData) {
  await requireAdminAction("commerce.manage");
  try {
    const { upsertJurisdictionGate } = await import("@/lib/collaboration-fees");
    await upsertJurisdictionGate({
      code: String(formData.get("code") || ""),
      label: String(formData.get("label") || ""),
      protectedPaymentsEnabled: formData.get("protectedPaymentsEnabled") === "on",
      escrowTermAllowed: formData.get("escrowTermAllowed") === "on",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the jurisdiction.";
    redirect(`/admin/fees?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/fees");
  revalidatePath("/admin/marketplace");
  redirect("/admin/fees?saved=jurisdiction");
}

export async function actionDeleteJurisdictionGate(formData: FormData) {
  await requireAdminAction("commerce.manage");
  try {
    const { deleteJurisdictionGate } = await import("@/lib/collaboration-fees");
    await deleteJurisdictionGate(String(formData.get("code") || ""));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove the jurisdiction.";
    redirect(`/admin/fees?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/fees");
  revalidatePath("/admin/marketplace");
  redirect("/admin/fees?removed=jurisdiction");
}

export async function actionDeleteFeeRule(formData: FormData) {
  await requireAdminAction("commerce.manage");
  try {
    const { deleteFeeRule } = await import("@/lib/collaboration-fees");
    await deleteFeeRule(String(formData.get("id") || ""));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove the fee rule.";
    redirect(`/admin/fees?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/fees");
  redirect("/admin/fees?removed=rule");
}

export async function actionDeleteFeeSnapshot(formData: FormData) {
  await requireAdminAction("commerce.manage");
  try {
    const { deleteFeeSnapshot } = await import("@/lib/collaboration-fees");
    await deleteFeeSnapshot(String(formData.get("id") || ""));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove the snapshot.";
    redirect(`/admin/fees?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/admin/fees");
  redirect("/admin/fees?removed=snapshot");
}
