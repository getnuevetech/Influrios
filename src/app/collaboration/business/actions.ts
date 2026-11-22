"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { specialtyLabel } from "@/lib/seed-data";
import { hasCurrentLegalRecord, recordLegalEvent } from "@/lib/legal";
import { assertCollabOsV1 } from "@/lib/collab-os";
import {
  activateBrief,
  buildCampaignIntentFields,
  createBrief,
  ensureOwnedBusinessWorkspace,
  getWorkspace,
  removeFromShortlist,
  requestManagedMatch,
  resolveCampaignIntentSaveMode,
  sendInquiry,
  updateBrief,
  updateInquiryStatus,
  addToShortlist,
  enteredNote,
  parseLocationParts,
} from "@/lib/business";
import { composerStep, composerSubmit, joinDraftRecipients, requestMarketChoice, requestVisibility } from "@/lib/request-composer";
import { domesticInviteDecision } from "@/lib/discovery-access";
import { verifiedDomesticCountry } from "@/lib/payment-engine";
import { getLaunchGate } from "@/lib/launch-gate";
import { prisma } from "@/lib/db";
import { contractHrefFromCampaign } from "@/lib/campaign-contract";
import {
  businessTransitionsFor,
  businessOwnsApplication,
  getMarketplaceApplication,
  inviteCreatorsIndependently,
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
  if (account.role !== "BUSINESS" && account.role !== "AGENCY") {
    redirect("/creator");
  }
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
  if (account.role !== "BUSINESS" && account.role !== "AGENCY") {
    redirect("/creator");
  }
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
    const locationParts = [
      String(formData.get("locationCity") ?? ""),
      String(formData.get("locationState") ?? ""),
      String(formData.get("locationCountry") ?? ""),
    ]
      .map((part) => part.trim())
      .filter(Boolean);
    fields = buildCampaignIntentFields({
      title: String(formData.get("title") ?? ""),
      goal: String(formData.get("goal") ?? ""),
      specialty: String(formData.get("specialty") ?? ""),
      budget: String(formData.get("budget") ?? ""),
      budgetCurrency: String(formData.get("budgetCurrency") ?? ""),
      location: locationParts.join(", "),
      platform: String(formData.get("platform") ?? ""),
      audience: String(formData.get("audience") ?? ""),
      collabType: String(formData.get("collabType") ?? ""),
      timeframe: String(formData.get("timeframe") ?? ""),
      summary: String(formData.get("summary") ?? ""),
      deliverables: String(formData.get("deliverables") ?? ""),
      responseDeadline: String(formData.get("responseDeadline") ?? ""),
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
  if (mode === "update") {
    const existing = ws.briefs.find((item) => item.id === briefId);
    if (existing?.status === "closed") {
      redirect(
        `${HUB}?error=${encodeURIComponent("This campaign is under contract and can no longer be edited.")}#drafts`,
      );
    }
  }
  const brief =
    mode === "update"
      ? await updateBrief(briefId, fields, ws.businessId)
      : await createBrief(fields, ws.businessId);
  revalidateHub();
  redirect(`/collaboration/business/request/${encodeURIComponent(brief.id)}?saved=draft`);
}

export async function actionWorkspaceRequest(formData: FormData) {
  const { account, ws } = await requireBusinessAccount();
  const intent = String(formData.get("submitIntent") ?? "draft");
  const briefId = String(formData.get("briefId") ?? "").trim();
  const step = composerStep(String(formData.get("composerStep") ?? ""));
  const back = briefId ? `/collaboration/business/request/${encodeURIComponent(briefId)}` : "/collaboration/business/request/new";
  const slugs = [...new Set(formData.getAll("creatorSlug").map((value) => String(value).trim()).filter(Boolean))];
  const visibility = requestVisibility(String(formData.get("distribution") ?? ""), slugs.length > 0);
  const decision = composerSubmit({ intent, visibility, recipientCount: slugs.length });
  if (!decision.ok) redirect(`${back}?step=${step}&error=${encodeURIComponent(decision.error)}`);
  // Market comes from the enabled markets list, not free text (a value saved earlier is kept).
  const markets = await prisma.country
    .findMany({ where: { enabled: true }, select: { code: true, name: true } })
    .catch(() => []);
  const savedBrief = briefId ? ws.briefs.find((item) => item.id === briefId) : undefined;
  const savedLocation = savedBrief ? parseLocationParts(savedBrief.location) : null;
  const market = requestMarketChoice(
    String(formData.get("locationCountry") ?? ""),
    markets,
    savedLocation ? savedLocation.country || savedLocation.city : "",
  );
  if (!market.ok) redirect(`${back}?step=2&error=${encodeURIComponent(market.error)}`);
  let fields;
  try {
    const locationParts = [
      String(formData.get("locationCity") ?? ""),
      String(formData.get("locationState") ?? ""),
      market.name,
    ]
      .map((part) => part.trim())
      .filter(Boolean);
    fields = buildCampaignIntentFields({
      title: String(formData.get("title") ?? ""),
      goal: String(formData.get("goal") ?? ""),
      specialty: String(formData.get("specialty") ?? ""),
      budget: String(formData.get("budget") ?? ""),
      budgetCurrency: String(formData.get("budgetCurrency") ?? ""),
      location: locationParts.join(", ") || "Remote",
      platform: String(formData.get("platform") ?? ""),
      audience: String(formData.get("audience") ?? ""),
      collabType: String(formData.get("collabType") ?? ""),
      timeframe: String(formData.get("timeframe") ?? ""),
      summary: String(formData.get("summary") ?? ""),
      deliverables: String(formData.get("deliverables") ?? ""),
      responseDeadline: String(formData.get("responseDeadline") ?? ""),
      distribution: visibility,
      draftRecipients: joinDraftRecipients(slugs),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the request.";
    redirect(`${back}?step=${step}&error=${encodeURIComponent(message)}`);
  }
  const mode = resolveCampaignIntentSaveMode({
    briefId,
    ownedBriefIds: ws.briefs.map((brief) => brief.id),
  });
  if (mode === "update") {
    const existing = ws.briefs.find((item) => item.id === briefId);
    if (existing?.status === "closed") {
      redirect(`${back}?step=${step}&error=${encodeURIComponent("This request is under contract and can no longer be edited.")}`);
    }
  }
  const brief = mode === "update" ? await updateBrief(briefId, fields, ws.businessId) : await createBrief(fields, ws.businessId);
  const saved = `/collaboration/business/request/${encodeURIComponent(brief.id)}`;
  // Direct invitations to the influencers chosen on the Audience step. Used by "Send invitations"
  // (private) and by "Publish request" (public listing + the people the business picked).
  const sendDirectInvitations = async (): Promise<string[]> => {
    if (slugs.length === 0) return [];
    const [gate, business, kycRows] = await Promise.all([
      getLaunchGate().catch(() => null),
      prisma.businessProfile.findUnique({ where: { userId: account.id }, select: { verifiedCountryCode: true } }).catch(() => null),
      prisma.creatorKycSubmission.findMany({
        where: { creatorSlug: { in: slugs }, status: "verified" },
        select: { creatorSlug: true, countryCode: true },
      }).catch(() => []),
    ]);
    const businessCountry = verifiedDomesticCountry(business?.verifiedCountryCode);
    for (const slug of slugs) {
      const influencer = kycRows.find((row) => row.creatorSlug === slug);
      const country = domesticInviteDecision({
        businessCountry,
        influencerCountry: verifiedDomesticCountry(influencer?.countryCode),
        selectedCountry: String(formData.get("locationCountry") ?? ""),
        crossBorderAllowed: gate?.crossBorderFundingEnabled === true,
      });
      if (!country.ok) redirect(`${saved}?step=${step}&error=${encodeURIComponent(country.error)}`);
    }
    const invited = await inviteCreatorsIndependently({
      workspaceId: ws.businessId,
      actorUserId: account.id,
      creatorSlugs: slugs,
      briefId: brief.id,
      offerText: `${fields.budgetCurrency} ${fields.budget}`.trim(),
      deliverables: fields.deliverables || fields.summary || fields.goal,
      responseDeadline: fields.responseDeadline ? new Date(fields.responseDeadline) : null,
      note: fields.title,
    });
    revalidateHub();
    if (!invited.ok) {
      redirect(`${saved}?step=${step}&error=${encodeURIComponent(invited.error)}`);
    }
    return invited.ids;
  };
  if (decision.action === "invite") {
    const ids = await sendDirectInvitations();
    // Invitations went out, so the request is live (invite-only), not a draft.
    await activateBrief(brief.id, ws.businessId);
    revalidateHub();
    redirect(`${saved}?saved=invites&sent=${ids.length}`);
  }
  if (decision.action === "publish") {
    try {
      const existing = (await listWorkspaceBusinessRequests(ws.businessId)).find((row) => row.briefId === brief.id);
      await upsertBusinessRequest({
        id: existing?.id,
        brand: brief.title.trim(),
        category: brief.specialty || brief.goal || "general",
        budget: brief.budget,
        location: brief.location.trim() || "Remote",
        tags: [brief.goal, brief.platform, brief.specialty].filter(Boolean),
        summary: brief.summary.trim() || brief.deliverables.trim() || brief.title.trim(),
        lookingFor: brief.specialty.trim() ? `${specialtyLabel(brief.specialty)} influencers` : brief.title.trim(),
        status: "published",
        sortOrder: 0,
        workspaceId: ws.businessId,
        briefId: brief.id,
        currency: brief.budgetCurrency,
        deliverableSummary: brief.deliverables.trim() || brief.summary.trim() || brief.goal,
        platforms: brief.platform ? [brief.platform] : [],
        applicationDeadline: brief.responseDeadline ? new Date(`${brief.responseDeadline}T00:00:00.000Z`) : null,
      });
      await activateBrief(brief.id, ws.businessId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not publish this request.";
      redirect(`${saved}?step=${step}&error=${encodeURIComponent(message)}`);
    }
    // The influencers the business picked on the Audience step also get a direct invitation
    // (they would otherwise only find the listing by browsing Opportunities).
    const ids = await sendDirectInvitations();
    revalidateHub();
    redirect(`${saved}?saved=published${ids.length ? `&sent=${ids.length}` : ""}`);
  }
  revalidateHub();
  redirect(`${saved}?saved=draft&step=${step}`);
}

export async function actionPublishCampaign(formData: FormData) {
  const { ws } = await requireBusinessAccount();
  const briefId = String(formData.get("briefId") ?? "").trim();
  const brief = ws.briefs.find((item) => item.id === briefId);
  if (!brief) {
    redirect(`${HUB}?error=${encodeURIComponent("Save this campaign before publishing it.")}#drafts`);
  }
  if (brief.status === "closed") {
    redirect(`${HUB}?error=${encodeURIComponent("This campaign is under contract and can no longer be published.")}#drafts`);
  }
  if (!brief.title.trim() || !brief.budget.trim()) {
    redirect(
      `${HUB}?intent=${encodeURIComponent(brief.id)}&error=${encodeURIComponent("Add a title and a budget before publishing.")}#suggestions`,
    );
  }
  try {
    const existing = (await listWorkspaceBusinessRequests(ws.businessId)).find((row) => row.briefId === brief.id);
    await upsertBusinessRequest({
      id: existing?.id,
      brand: brief.title.trim(),
      category: brief.specialty || brief.goal || "general",
      budget: brief.budget,
      location: brief.location.trim() || "Remote",
      tags: [brief.goal, brief.platform, brief.specialty, brief.collabType].filter(Boolean),
      summary: brief.summary.trim() || brief.deliverables.trim() || brief.title.trim(),
      lookingFor: brief.specialty.trim() ? `${specialtyLabel(brief.specialty)} influencers` : brief.title.trim(),
      status: "published",
      sortOrder: 0,
      workspaceId: ws.businessId,
      briefId: brief.id,
      currency: brief.budgetCurrency,
      deliverableSummary: brief.deliverables.trim() || brief.summary.trim() || brief.goal,
      platforms: brief.platform ? [brief.platform] : [],
      applicationDeadline: brief.responseDeadline ? new Date(`${brief.responseDeadline}T00:00:00.000Z`) : null,
    });
    await activateBrief(brief.id, ws.businessId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not publish this campaign.";
    redirect(`${HUB}?intent=${encodeURIComponent(brief.id)}&error=${encodeURIComponent(message)}#suggestions`);
  }
  revalidateHub();
  revalidatePath("/business/campaigns");
  redirect(`${HUB}?tab=requests&saved=published`);
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
  const { account, ws } = await requireBusinessAccount();
  const briefId = String(formData.get("briefId") ?? "").trim();
  const brief = briefId ? ws.briefs.find((item) => item.id === briefId) : undefined;
  if (!brief) {
    redirect(`${HUB}?error=${encodeURIComponent("Save this campaign before publishing it.")}`);
  }
  const title = brief.title.trim();
  if (!title) {
    redirect(`${HUB}?intent=${encodeURIComponent(brief.id)}&error=${encodeURIComponent("Add a campaign title before publishing.")}#intent`);
  }
  const slugs = formData
    .getAll("creatorSlug")
    .map((value) => String(value).trim())
    .filter(Boolean);
  if (!slugs.length) {
    redirect(
      `${HUB}?intent=${encodeURIComponent(brief.id)}&error=${encodeURIComponent(
        "Select an influencer before publishing this campaign.",
      )}#publish`,
    );
  }
  try {
    const existing = (await listWorkspaceBusinessRequests(ws.businessId)).find((row) => row.briefId === brief.id);
    const request = await upsertBusinessRequest({
      id: existing?.id,
      brand: title,
      category: brief.specialty || "general",
      budget: brief.budget,
      location: brief.location || "Remote",
      tags: [brief.goal, brief.platform, brief.specialty].filter(Boolean),
      summary: brief.summary.trim() || title,
      lookingFor: brief.specialty.trim() ? `${specialtyLabel(brief.specialty)} influencers` : title,
      status: "published",
      sortOrder: 0,
      workspaceId: ws.businessId,
      briefId: brief.id,
      currency: brief.budgetCurrency,
      deliverableSummary: brief.summary.trim() || brief.goal,
      platforms: brief.platform ? [brief.platform] : [],
    });
    if (slugs.length) {
      const deadlineRaw = String(formData.get("responseDeadline") ?? "").trim();
      const deadline = deadlineRaw ? new Date(deadlineRaw) : null;
      const invited = await inviteCreatorsIndependently({
        workspaceId: ws.businessId,
        actorUserId: account.id,
        creatorSlugs: slugs,
        requestId: request.id,
        briefId: brief.id,
        offerText: String(formData.get("offerText") ?? "").trim() || `${brief.budgetCurrency} ${brief.budget}`.trim(),
        deliverables: String(formData.get("deliverables") ?? "").trim() || brief.summary.trim() || brief.goal,
        responseDeadline: deadline && !Number.isNaN(deadline.getTime()) ? deadline : null,
        note: title,
      });
      if (!invited.ok) {
        redirect(`${HUB}?error=${encodeURIComponent(invited.error)}#requests`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not publish the request.";
    redirect(`${HUB}?error=${encodeURIComponent(message)}#requests`);
  }
  await activateBrief(brief.id, ws.businessId).catch(() => undefined);
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

export async function actionAdvanceLead(formData: FormData) {
  const { ws } = await requireBusinessAccount();
  const id = String(formData.get("inquiryId") ?? "");
  const status = String(formData.get("status") ?? "");
  const result = await updateInquiryStatus(id, status, ws.businessId);
  revalidateHub();
  if (!result.ok) {
    redirect(`${HUB}?error=${encodeURIComponent(result.error)}#applicants`);
  }
  redirect(`${HUB}?lead=${encodeURIComponent(result.inquiry.status)}#applicants`);
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

/**
 * The hub no longer sets a plan directly (#12, #4). Plan changes go through checkout on
 * /business/billing. This action stays only to redirect a stale form submission there.
 */
export async function actionSetPlan() {
  await requireBusinessAccount();
  redirect(`/business/billing?error=${encodeURIComponent("Manage your plan from Billing.")}`);
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
  const next = String(formData.get("next") ?? "").trim();
  const invited = await inviteCreatorsIndependently({
    workspaceId: ws.businessId,
    actorUserId: account.id,
    creatorSlugs: [creatorSlug],
    requestId: target.id,
    note: enteredNote(note),
  });
  if (!invited.ok) {
    redirect(`${next || HUB}?error=${encodeURIComponent(invited.error)}${next ? "" : "#suggestions"}`);
  }
  revalidateHub();
  redirect(next || `${HUB}?invited=${encodeURIComponent(creatorSlug)}#applicants`);
}

/** Several independent invitations for one campaign. One response does not change the others. */
export async function actionInviteSelectedCreators(formData: FormData) {
  const account = await requireBusinessSession();
  const ws = await getWorkspace(account.id);
  const slugs = formData.getAll("creatorSlug").map((value) => String(value));
  const deadlineRaw = String(formData.get("responseDeadline") ?? "").trim();
  const deadline = deadlineRaw ? new Date(`${deadlineRaw}T23:59:59.000Z`) : null;
  const invited = await inviteCreatorsIndependently({
    workspaceId: ws.businessId,
    actorUserId: account.id,
    creatorSlugs: slugs,
    requestId: String(formData.get("requestId") ?? ""),
    briefId: String(formData.get("briefId") ?? ""),
    offerText: String(formData.get("offerText") ?? ""),
    deliverables: String(formData.get("deliverables") ?? ""),
    responseDeadline: deadline && !Number.isNaN(deadline.getTime()) ? deadline : null,
    note: enteredNote(String(formData.get("note") ?? "")),
  });
  revalidateHub();
  if (!invited.ok) {
    redirect(`${HUB}?error=${encodeURIComponent(invited.error)}#suggestions`);
  }
  redirect(`${HUB}?invited=${encodeURIComponent(String(invited.ids.length))}#applicants`);
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
  const ownedBriefIds = ws.briefs.map((brief) => brief.id);
  if (!existing || !businessOwnsApplication(existing, ownedIds, ownedBriefIds)) {
    redirect(
      `${HUB}?error=${encodeURIComponent("You can only manage applications on your published requests.")}#applicants`,
    );
  }
  const allowed = businessTransitionsFor(existing);
  if (!allowed.includes(toStatus)) {
    redirect(
      `/collaboration/applications/${applicationId}?error=${encodeURIComponent(
        "Open this application to review details before taking that action.",
      )}`,
    );
  }
  if (toStatus === "COLLABORATION_DRAFTED") {
    const slug = (existing.creatorSlug ?? "").trim();
    const shortlisted = ws.shortlist.some((item) => item.creatorSlug === slug);
    if (!shortlisted) {
      redirect(
        `/collaboration/applications/${applicationId}?error=${encodeURIComponent(
          "Shortlist this influencer before creating a contract.",
        )}`,
      );
    }
  }
  let updated: Awaited<ReturnType<typeof transitionMarketplaceApplication>>;
  try {
    updated = await transitionMarketplaceApplication({
      id: applicationId,
      toStatus,
      actorUserId: account.id,
      note: String(formData.get("note") ?? "") || undefined,
    });
    revalidateHub();
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "digest" in error &&
      String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    redirect(
      `/collaboration/applications/${applicationId}?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Transition failed.",
      )}`,
    );
  }
  if (toStatus === "COLLABORATION_DRAFTED") {
    const creator = updated.toSlug || updated.fromSlug;
    const brief = updated.briefId ? ws.briefs.find((item) => item.id === updated.briefId) ?? null : null;
    redirect(
      creator
        ? contractHrefFromCampaign({ creatorSlug: creator, brief, applicationId })
        : `${HUB}?drafted=1#applicants`,
    );
  }
  redirect(`/collaboration/applications/${applicationId}?app=${encodeURIComponent(toStatus)}`);
}

/** Business withdraws an invitee’s participation with reason + message; notifies the influencer once. */
export async function actionWithdrawParticipation(formData: FormData) {
  const { account, ws } = await requireBusinessAccount();
  const applicationId = String(formData.get("applicationId") ?? "").trim();
  const briefId = String(formData.get("briefId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const returnTab = String(formData.get("returnTab") ?? "requests");
  const close = `${HUB}?tab=${encodeURIComponent(returnTab)}&request=${encodeURIComponent(briefId)}`;
  const existing = await getMarketplaceApplication(applicationId);
  const ownedIds = (await listWorkspaceBusinessRequests(ws.businessId)).map((row) => row.id);
  const ownedBriefIds = ws.briefs.map((brief) => brief.id);
  if (!existing || !businessOwnsApplication(existing, ownedIds, ownedBriefIds)) {
    redirect(`${close}&error=${encodeURIComponent("You can only withdraw invitations on your requests.")}`);
  }
  const contracts = await prisma.contractDocument.findMany({
    where: { applicationId, status: { notIn: ["voided", "declined"] } },
    select: { id: true, status: true, fundingId: true },
  }).catch(() => []);
  const signed = contracts.some((row) => row.status === "signed");
  const fundingIds = contracts.map((row) => row.fundingId).filter((id): id is string => Boolean(id));
  const fundingRows = fundingIds.length
    ? await prisma.collaborationFunding.findMany({ where: { id: { in: fundingIds } }, select: { id: true, status: true } }).catch(() => [])
    : [];
  const funded = fundingRows.some((row) => row.status === "held" || row.status === "completed" || row.status === "awaiting_provider");
  const { withdrawParticipationPlan } = await import("@/lib/request-lifecycle");
  const plan = withdrawParticipationPlan({
    invitationStatus: existing.status,
    hasSignedAgreement: signed,
    hasFundingOrPaymentHistory: funded,
    alreadyWithdrawn: existing.status === "WITHDRAWN",
    reason,
    message,
  });
  if (!plan.ok) {
    redirect(`${close}&withdraw=${encodeURIComponent(applicationId)}&error=${encodeURIComponent(plan.error)}`);
  }
  // Recheck eligibility at confirmation — an acceptance mid-flight must not be silently removed.
  const fresh = await getMarketplaceApplication(applicationId);
  if (!fresh || fresh.status !== existing.status) {
    redirect(`${close}&error=${encodeURIComponent("This invitation changed. Refresh and try again. Nothing was withdrawn.")}`);
  }
  const note = `[Withdrawn by business] ${reason}. ${message}`.slice(0, 2_000);
  try {
    await transitionMarketplaceApplication({
      id: applicationId,
      toStatus: "WITHDRAWN",
      actorUserId: account.id,
      note,
    });
  } catch (error) {
    redirect(
      `${close}&error=${encodeURIComponent(error instanceof Error ? error.message : "Withdrawal failed.")}`,
    );
  }
  const slug = (fresh.toSlug || fresh.fromSlug || "").trim();
  if (slug) {
    // The invitee's in-app notice and withdrawal email (invite.withdrawn, with the recorded reason) are sent by
    // transitionMarketplaceApplication on the persisted WITHDRAWN transition (P1-AUD-02).
    const brief = ws.briefs.find((item) => item.id === (briefId || fresh.briefId || ""));
    await prisma.auditLog
      .create({
        data: {
          actor: account.email,
          action: "invitation_withdrawn_by_business",
          objectType: "MarketplaceApplication",
          objectId: applicationId,
          after: { reason, message, creatorSlug: slug, briefId: brief?.id ?? null },
        },
      })
      .catch(() => undefined);
  }
  revalidateHub();
  redirect(`${close}&saved=withdrawn`);
}

/** Delete or close a request using server-side eligibility rules. */
export async function actionDeleteBusinessRequest(formData: FormData) {
  const { account, ws } = await requireBusinessAccount();
  const briefId = String(formData.get("briefId") ?? "").trim();
  const brief = ws.briefs.find((item) => item.id === briefId);
  if (!brief) {
    redirect(`${HUB}?tab=requests&error=${encodeURIComponent("That request was not found.")}`);
  }
  const deliveries = await prisma.marketplaceApplication.findMany({
    where: { briefId, kind: "business_request" },
    select: { id: true, status: true, toSlug: true },
  }).catch(() => []);
  const invites = deliveries.filter((row) => row.toSlug);
  const pending = invites.filter((row) => !["WITHDRAWN", "DECLINED", "EXPIRED", "ACCEPTED", "COLLABORATION_DRAFTED"].includes(row.status));
  const accepted = invites.filter((row) => row.status === "ACCEPTED" || row.status === "COLLABORATION_DRAFTED");
  const contracts = accepted.length
    ? await prisma.contractDocument.findMany({
        where: { applicationId: { in: accepted.map((row) => row.id) }, status: { notIn: ["voided", "declined"] } },
        select: { id: true, status: true, fundingId: true, applicationId: true },
      }).catch(() => [])
    : [];
  const signed = contracts.some((row) => row.status === "signed");
  const fundingIds = contracts.map((row) => row.fundingId).filter((id): id is string => Boolean(id));
  const fundingRows = fundingIds.length
    ? await prisma.collaborationFunding.findMany({ where: { id: { in: fundingIds } }, select: { status: true } }).catch(() => [])
    : [];
  const funded = fundingRows.some((row) => ["held", "completed", "awaiting_provider"].includes(row.status));
  const completed = fundingRows.some((row) => row.status === "completed");
  const acceptedWithoutAgreement = accepted.filter((row) => !contracts.some((contract) => contract.applicationId === row.id && contract.status === "signed")).length;
  const { requestDeletePlan } = await import("@/lib/request-lifecycle");
  const plan = requestDeletePlan({
    briefStatus: brief.status,
    inviteCount: invites.length,
    pendingInviteCount: pending.length,
    acceptedWithoutAgreementCount: acceptedWithoutAgreement,
    hasSignedAgreement: signed,
    hasFundingOrPaymentHistory: funded,
    collaborationCompleted: completed,
  });
  if (plan.kind === "block") {
    redirect(`${HUB}?tab=requests&request=${encodeURIComponent(briefId)}&error=${encodeURIComponent(plan.reason)}`);
  }
  if (plan.kind === "cancel_settlement") {
    redirect(`${HUB}?tab=active&error=${encodeURIComponent(plan.reason)}`);
  }
  if (plan.kind === "archive") {
    await updateBrief(briefId, { ...brief, status: "closed" }, ws.businessId).catch(() => undefined);
    revalidateHub();
    redirect(`${HUB}?tab=requests&saved=archived`);
  }
  if (plan.kind === "delete" && plan.confirm === "remove_draft") {
    await prisma.marketplaceApplication.deleteMany({ where: { briefId } }).catch(() => undefined);
    await prisma.businessBrief.delete({ where: { id: briefId } }).catch(() => undefined);
    await prisma.auditLog
      .create({
        data: {
          actor: account.email,
          action: "business_request_deleted",
          objectType: "BusinessBrief",
          objectId: briefId,
          after: { title: brief.title },
        },
      })
      .catch(() => undefined);
    revalidateHub();
    redirect(`${HUB}?tab=requests&saved=deleted`);
  }
  // Revoke pending invitations, then close the request.
  for (const row of pending) {
    await transitionMarketplaceApplication({
      id: row.id,
      toStatus: "WITHDRAWN",
      actorUserId: account.id,
      note: "[Request deleted] Pending invitation revoked.",
    }).catch(() => undefined);
  }
  await updateBrief(briefId, { ...brief, status: "closed" }, ws.businessId);
  revalidateHub();
  redirect(`${HUB}?tab=requests&saved=closed`);
}

export async function actionCloseBusinessRequest(formData: FormData) {
  const { ws } = await requireBusinessAccount();
  const briefId = String(formData.get("briefId") ?? "").trim();
  const brief = ws.briefs.find((item) => item.id === briefId);
  if (!brief) redirect(`${HUB}?tab=requests&error=${encodeURIComponent("That request was not found.")}`);
  if (brief.status === "closed" || brief.status === "cancelled") {
    redirect(`${HUB}?tab=requests&request=${encodeURIComponent(briefId)}`);
  }
  await updateBrief(briefId, { ...brief, status: "closed" }, ws.businessId);
  revalidateHub();
  redirect(`${HUB}?tab=requests&saved=closed`);
}
