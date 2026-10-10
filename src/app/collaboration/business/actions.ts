"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { specialtyLabel } from "@/lib/seed-data";
import { hasCurrentLegalRecord, recordLegalEvent } from "@/lib/legal";
import { assertCollabOsV1 } from "@/lib/collab-os";
import {
  buildCampaignIntentFields,
  createBrief,
  ensureOwnedBusinessWorkspace,
  getWorkspace,
  removeFromShortlist,
  requestManagedMatch,
  resolveCampaignIntentSaveMode,
  sendInquiry,
  setBusinessPlan,
  updateBrief,
  updateInquiryStatus,
  addToShortlist,
  enteredNote,
} from "@/lib/business";
import type { BusinessPlanCode } from "@/lib/business-entitlements";
import {
  businessOwnsApplication,
  createMarketplaceApplication,
  getMarketplaceApplication,
  listWorkspaceBusinessRequests,
  MARKETPLACE_APPLICATION_STATUSES,
  transitionMarketplaceApplication,
  upsertBusinessRequest,
  type MarketplaceApplicationStatus,
} from "@/lib/marketplace-listings";

const HUB = "/collaboration/business";

async function requireBusinessSession() {
  await assertCollabOsV1();
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect(`/login?next=${encodeURIComponent(HUB)}&gate=business`);
  const accepted = await hasCurrentLegalRecord({
    documentKey: "business-terms",
    userId: account.id,
  }).catch(() => true);
  if (!accepted) {
    redirect(`${HUB}?error=${encodeURIComponent("Agree to the Business / Brand Terms before using the hub.")}`);
  }
  return account;
}

async function requireBusinessAccount() {
  await assertCollabOsV1();
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect(`/login?next=${encodeURIComponent(HUB)}&gate=business`);
  const accepted = await hasCurrentLegalRecord({
    documentKey: "business-terms",
    userId: account.id,
  }).catch(() => true);
  if (!accepted) {
    redirect(`${HUB}?error=${encodeURIComponent("Agree to the Business / Brand Terms before using the hub.")}`);
  }
  const ws = await getWorkspace(account.id);
  return { account, ws };
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
    await ensureOwnedBusinessWorkspace(account.id);
    redirect(`${HUB}?terms=1`);
  }
  await recordLegalEvent({
    trigger: "business_registration",
    context: "business_registration",
    userId: account.id,
    userRole: "BUSINESS",
    extraKeys: ["terms-of-service", "privacy-policy"],
  });
  await ensureOwnedBusinessWorkspace(account.id);
  redirect(`${HUB}?terms=1`);
}

export async function actionSaveCampaignIntent(formData: FormData) {
  const { ws } = await requireBusinessAccount();
  let fields;
  try {
    fields = buildCampaignIntentFields({
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the campaign intent.";
    redirect(`${HUB}?error=${encodeURIComponent(message)}#suggestions`);
  }
  const briefId = String(formData.get("briefId") ?? "").trim();
  const mode = resolveCampaignIntentSaveMode({
    briefId,
    ownedBriefIds: ws.briefs.map((brief) => brief.id),
  });
  const brief =
    mode === "update"
      ? await updateBrief(briefId, fields, ws.businessId)
      : await createBrief(fields, ws.businessId);
  revalidateHub();
  redirect(
    `${HUB}?intent=${encodeURIComponent(brief.id)}&suggestions=1&mode=${mode}#suggestions`,
  );
}

/** W2.3 — re-rank suggestions for an existing Campaign Intent without creating a new brief. */
export async function actionRefreshCampaignSuggestions(formData: FormData) {
  const { ws } = await requireBusinessAccount();
  const briefId = String(formData.get("briefId") ?? "").trim();
  const brief = ws.briefs.find((item) => item.id === briefId);
  if (!brief) {
    redirect(`${HUB}?error=${encodeURIComponent("Save a campaign intent before refreshing suggestions.")}`);
  }
  revalidateHub();
  redirect(`${HUB}?intent=${encodeURIComponent(brief.id)}&suggestions=1&refreshed=1#suggestions`);
}

export async function actionPostBusinessRequest(formData: FormData) {
  const { ws } = await requireBusinessAccount();
  const briefId = String(formData.get("briefId") ?? "").trim();
  const brief = ws.briefs.find((item) => item.id === briefId) ?? ws.briefs[0];
  if (!brief) {
    redirect(`${HUB}?error=${encodeURIComponent("Save a campaign intent before posting a request.")}`);
  }
  try {
    await upsertBusinessRequest({
      brand: ws.name,
      category: brief.specialty,
      budget: brief.budget,
      location: brief.location,
      tags: [brief.goal, brief.platform, brief.specialty].filter(Boolean),
      summary: brief.summary,
      lookingFor: brief.specialty.trim() ? `${specialtyLabel(brief.specialty)} influencers` : "",
      status: "published",
      sortOrder: 0,
      workspaceId: ws.businessId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not publish the request.";
    redirect(`${HUB}?error=${encodeURIComponent(message)}#requests`);
  }
  revalidateHub();
  redirect(`${HUB}?posted=1#requests`);
}

export async function actionAddShortlist(formData: FormData) {
  const { ws } = await requireBusinessAccount();
  const slug = String(formData.get("slug") ?? "");
  const note = enteredNote(String(formData.get("note") ?? ""));
  const result = await addToShortlist(slug, note, ws.businessId);
  revalidateHub();
  revalidatePath(`/creators/${slug}`);
  if (!result.ok) {
    redirect(`${HUB}?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`${HUB}?added=${encodeURIComponent(slug)}#shortlist`);
}

export async function actionRemoveShortlist(formData: FormData) {
  const { ws } = await requireBusinessAccount();
  const slug = String(formData.get("slug") ?? "");
  await removeFromShortlist(slug, ws.businessId);
  revalidateHub();
  redirect(`${HUB}#shortlist`);
}

export async function actionSendInquiry(formData: FormData) {
  const { ws } = await requireBusinessAccount();
  const creatorSlug = String(formData.get("creatorSlug") ?? "");
  const message = String(formData.get("message") ?? "");
  const briefId = String(formData.get("briefId") ?? "") || undefined;
  const result = await sendInquiry({ creatorSlug, message, briefId }, ws.businessId);
  revalidateHub();
  if (!result.ok) {
    redirect(`${HUB}?error=${encodeURIComponent(result.error)}`);
  }
  const { recordCreatorInquiryConversion } = await import("@/lib/short-link");
  void recordCreatorInquiryConversion(creatorSlug).catch(() => undefined);
  redirect(`${HUB}?inquiry=1#applicants`);
}

export async function actionReplyInquiry(formData: FormData) {
  const { ws } = await requireBusinessAccount();
  const id = String(formData.get("inquiryId") ?? "");
  const result = await updateInquiryStatus(id, "replied", ws.businessId);
  revalidateHub();
  if (!result.ok) {
    redirect(`${HUB}?error=${encodeURIComponent(result.error)}#applicants`);
  }
  redirect(`${HUB}?replied=1#applicants`);
}

export async function actionDeclineInquiry(formData: FormData) {
  const { ws } = await requireBusinessAccount();
  const id = String(formData.get("inquiryId") ?? "");
  const result = await updateInquiryStatus(id, "declined", ws.businessId);
  revalidateHub();
  if (!result.ok) {
    redirect(`${HUB}?error=${encodeURIComponent(result.error)}#applicants`);
  }
  redirect(`${HUB}?declined=1#applicants`);
}

export async function actionShortlistFromInquiry(formData: FormData) {
  const { ws } = await requireBusinessAccount();
  const slug = String(formData.get("creatorSlug") ?? "");
  const note = enteredNote(String(formData.get("note") ?? ""));
  const result = await addToShortlist(slug, note, ws.businessId);
  revalidateHub();
  revalidatePath(`/creators/${slug}`);
  if (!result.ok) {
    redirect(`${HUB}?error=${encodeURIComponent(result.error)}#applicants`);
  }
  redirect(`${HUB}?added=${encodeURIComponent(slug)}#shortlist`);
}

export async function actionSetPlan(formData: FormData) {
  const { ws } = await requireBusinessAccount();
  const plan = String(formData.get("plan") ?? "") as BusinessPlanCode;
  await setBusinessPlan(plan, ws.businessId);
  revalidateHub();
  redirect(`${HUB}?plan=1#pricing`);
}

export async function actionRequestManagedMatch(formData: FormData) {
  const { ws } = await requireBusinessAccount();
  const briefId = String(formData.get("briefId") ?? "");
  const result = await requestManagedMatch(briefId, ws.businessId);
  revalidateHub();
  if (!result.ok) {
    redirect(`${HUB}?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`${HUB}?queued=1`);
}

/** W2.3c — invite a suggested/shortlisted creator onto an owned published request. */
export async function actionInviteCreatorToRequest(formData: FormData) {
  const account = await requireBusinessSession();
  const ws = await getWorkspace(account.id);
  const creatorSlug = String(formData.get("creatorSlug") ?? "").trim();
  const requestId = String(formData.get("requestId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!creatorSlug) {
    redirect(`${HUB}?error=${encodeURIComponent("Choose a creator to invite.")}#suggestions`);
  }
  const own = await listWorkspaceBusinessRequests(ws.businessId);
  const target = (requestId ? own.find((row) => row.id === requestId) : null) ?? own[0];
  if (!target) {
    redirect(
      `${HUB}?error=${encodeURIComponent("Publish a business request before inviting creators.")}#create-request`,
    );
  }
  try {
    await createMarketplaceApplication({
      kind: "business_request",
      businessRequestId: target.id,
      fromUserId: account.id,
      toSlug: creatorSlug,
      note: enteredNote(note),
    });
  } catch (error) {
    redirect(
      `${HUB}?error=${encodeURIComponent(error instanceof Error ? error.message : "Invite failed.")}#suggestions`,
    );
  }
  revalidateHub();
  redirect(`${HUB}?invited=${encodeURIComponent(creatorSlug)}#applicants`);
}

/** W2.3c — advance a marketplace application on an owned request. */
export async function actionTransitionMarketplaceApplication(formData: FormData) {
  const account = await requireBusinessSession();
  const ws = await getWorkspace(account.id);
  const applicationId = String(formData.get("applicationId") ?? "").trim();
  const toStatus = String(formData.get("toStatus") ?? "").trim() as MarketplaceApplicationStatus;
  if (!applicationId || !(MARKETPLACE_APPLICATION_STATUSES as readonly string[]).includes(toStatus)) {
    redirect(`${HUB}?error=${encodeURIComponent("Invalid application transition.")}#applicants`);
  }
  const existing = await getMarketplaceApplication(applicationId);
  const ownedIds = (await listWorkspaceBusinessRequests(ws.businessId)).map((row) => row.id);
  if (!existing || !businessOwnsApplication(existing, ownedIds)) {
    redirect(
      `${HUB}?error=${encodeURIComponent("You can only manage applications on your published requests.")}#applicants`,
    );
  }
  try {
    const updated = await transitionMarketplaceApplication({
      id: applicationId,
      toStatus,
      actorUserId: account.id,
      note: String(formData.get("note") ?? "") || undefined,
    });
    revalidateHub();
    if (toStatus === "COLLABORATION_DRAFTED") {
      const creator = updated.toSlug || updated.fromSlug;
      redirect(
        creator
          ? `/collaboration/contract?creator=${encodeURIComponent(creator)}`
          : `${HUB}?drafted=1#applicants`,
      );
    }
    redirect(`${HUB}?app=${encodeURIComponent(toStatus)}#applicants`);
  } catch (error) {
    redirect(
      `${HUB}?error=${encodeURIComponent(error instanceof Error ? error.message : "Transition failed.")}#applicants`,
    );
  }
}
