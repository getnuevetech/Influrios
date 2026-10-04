"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { hasCurrentLegalRecord, recordLegalEvent } from "@/lib/legal";
import { assertCollabOsV1 } from "@/lib/collab-os";
import {
  addToShortlist,
  buildCampaignIntentFields,
  createBrief,
  getWorkspace,
  removeFromShortlist,
  requestManagedMatch,
  resolveCampaignIntentSaveMode,
  sendInquiry,
  setBusinessPlan,
  updateBrief,
  updateInquiryStatus,
} from "@/lib/business";
import type { BusinessPlanCode } from "@/lib/business-entitlements";
import { upsertBusinessRequest } from "@/lib/marketplace-listings";

const HUB = "/collaboration/business";

async function requireBusinessTerms() {
  await assertCollabOsV1();
  const account = await getAccountSession().catch(() => null);
  if (!account) return;
  const accepted = await hasCurrentLegalRecord({
    documentKey: "business-terms",
    userId: account.id,
  }).catch(() => true);
  if (!accepted) {
    redirect(`${HUB}?error=${encodeURIComponent("Agree to the Business / Brand Terms before using the hub.")}`);
  }
}

function revalidateHub() {
  revalidatePath(HUB);
  revalidatePath("/business/workspace");
  revalidatePath("/business");
  revalidatePath("/collaboration");
}

export async function actionAcceptBusinessTerms(formData: FormData) {
  if (formData.get("acceptBusiness") !== "on") {
    redirect(`${HUB}?error=${encodeURIComponent("Agree to the Business / Brand Terms to continue.")}`);
  }
  const account = await getAccountSession();
  if (!account) redirect(`/login?next=${encodeURIComponent(HUB)}`);
  if (await hasCurrentLegalRecord({ documentKey: "business-terms", userId: account.id })) {
    redirect(`${HUB}?terms=1`);
  }
  await recordLegalEvent({
    trigger: "business_registration",
    context: "business_registration",
    userId: account.id,
    userRole: "BUSINESS",
    extraKeys: ["terms-of-service", "privacy-policy"],
  });
  redirect(`${HUB}?terms=1`);
}

export async function actionSaveCampaignIntent(formData: FormData) {
  await requireBusinessTerms();
  const ws = await getWorkspace();
  const fields = buildCampaignIntentFields({
    title: String(formData.get("title") ?? ""),
    goal: String(formData.get("goal") ?? ""),
    specialty: String(formData.get("specialty") ?? ""),
    budget: String(formData.get("budget") ?? ""),
    location: String(formData.get("location") ?? ""),
    platform: String(formData.get("platform") ?? ""),
    audience: String(formData.get("audience") ?? ""),
    collabType: String(formData.get("collabType") ?? ""),
    timeframe: String(formData.get("timeframe") ?? ""),
    summary: String(formData.get("summary") ?? ""),
  });
  const briefId = String(formData.get("briefId") ?? "").trim();
  const mode = resolveCampaignIntentSaveMode({
    briefId,
    ownedBriefIds: ws.briefs.map((brief) => brief.id),
  });
  const brief =
    mode === "update"
      ? await updateBrief(briefId, fields)
      : await createBrief(fields);
  revalidateHub();
  redirect(
    `${HUB}?intent=${encodeURIComponent(brief.id)}&suggestions=1&mode=${mode}#suggestions`,
  );
}

/** W2.3 — re-rank suggestions for an existing Campaign Intent without creating a new brief. */
export async function actionRefreshCampaignSuggestions(formData: FormData) {
  await requireBusinessTerms();
  const ws = await getWorkspace();
  const briefId = String(formData.get("briefId") ?? "").trim();
  const brief = ws.briefs.find((item) => item.id === briefId);
  if (!brief) {
    redirect(`${HUB}?error=${encodeURIComponent("Save a campaign intent before refreshing suggestions.")}`);
  }
  revalidateHub();
  redirect(`${HUB}?intent=${encodeURIComponent(brief.id)}&suggestions=1&refreshed=1#suggestions`);
}

export async function actionPostBusinessRequest(formData: FormData) {
  await requireBusinessTerms();
  const ws = await getWorkspace();
  const briefId = String(formData.get("briefId") ?? "").trim();
  const brief = ws.briefs.find((item) => item.id === briefId) ?? ws.briefs[0];
  if (!brief) {
    redirect(`${HUB}?error=${encodeURIComponent("Save a campaign intent before posting a request.")}`);
  }
  await upsertBusinessRequest({
    brand: ws.name,
    category: brief.specialty,
    budget: brief.budget,
    location: brief.location,
    tags: [brief.goal, brief.platform, brief.specialty].filter(Boolean),
    summary: brief.summary || `${brief.goal} collaboration for ${ws.name}`,
    lookingFor: `${brief.specialty} influencers`,
    status: "published",
    sortOrder: 0,
  });
  revalidateHub();
  redirect(`${HUB}?posted=1#requests`);
}

export async function actionAddShortlist(formData: FormData) {
  await requireBusinessTerms();
  const slug = String(formData.get("slug") ?? "");
  const note = String(formData.get("note") ?? "") || undefined;
  const result = await addToShortlist(slug, note);
  revalidateHub();
  revalidatePath(`/creators/${slug}`);
  if (!result.ok) {
    redirect(`${HUB}?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`${HUB}?added=${encodeURIComponent(slug)}#shortlist`);
}

export async function actionRemoveShortlist(formData: FormData) {
  await requireBusinessTerms();
  const slug = String(formData.get("slug") ?? "");
  await removeFromShortlist(slug);
  revalidateHub();
  redirect(`${HUB}#shortlist`);
}

export async function actionSendInquiry(formData: FormData) {
  await requireBusinessTerms();
  const creatorSlug = String(formData.get("creatorSlug") ?? "");
  const message = String(formData.get("message") ?? "");
  const briefId = String(formData.get("briefId") ?? "") || undefined;
  const result = await sendInquiry({ creatorSlug, message, briefId });
  revalidateHub();
  if (!result.ok) {
    redirect(`${HUB}?error=${encodeURIComponent(result.error)}`);
  }
  const { recordCreatorInquiryConversion } = await import("@/lib/short-link");
  void recordCreatorInquiryConversion(creatorSlug).catch(() => undefined);
  redirect(`${HUB}?inquiry=1#applicants`);
}

export async function actionReplyInquiry(formData: FormData) {
  await requireBusinessTerms();
  const id = String(formData.get("inquiryId") ?? "");
  const result = await updateInquiryStatus(id, "replied");
  revalidateHub();
  if (!result.ok) {
    redirect(`${HUB}?error=${encodeURIComponent(result.error)}#applicants`);
  }
  redirect(`${HUB}?replied=1#applicants`);
}

export async function actionDeclineInquiry(formData: FormData) {
  await requireBusinessTerms();
  const id = String(formData.get("inquiryId") ?? "");
  const result = await updateInquiryStatus(id, "declined");
  revalidateHub();
  if (!result.ok) {
    redirect(`${HUB}?error=${encodeURIComponent(result.error)}#applicants`);
  }
  redirect(`${HUB}?declined=1#applicants`);
}

export async function actionShortlistFromInquiry(formData: FormData) {
  await requireBusinessTerms();
  const slug = String(formData.get("creatorSlug") ?? "");
  const note = String(formData.get("note") ?? "") || "Shortlisted from inquiry";
  const result = await addToShortlist(slug, note);
  revalidateHub();
  revalidatePath(`/creators/${slug}`);
  if (!result.ok) {
    redirect(`${HUB}?error=${encodeURIComponent(result.error)}#applicants`);
  }
  redirect(`${HUB}?added=${encodeURIComponent(slug)}#shortlist`);
}

export async function actionSetPlan(formData: FormData) {
  await requireBusinessTerms();
  const plan = String(formData.get("plan") ?? "") as BusinessPlanCode;
  await setBusinessPlan(plan);
  revalidateHub();
  redirect(`${HUB}?plan=1#pricing`);
}

export async function actionRequestManagedMatch(formData: FormData) {
  await requireBusinessTerms();
  const briefId = String(formData.get("briefId") ?? "");
  const result = await requestManagedMatch(briefId);
  revalidateHub();
  if (!result.ok) {
    redirect(`${HUB}?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`${HUB}?queued=1`);
}
