"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";
import { contractHrefFromCampaign } from "@/lib/campaign-contract";
import { getCreatorSessionDraft } from "@/lib/claim";
import { assertCollabOsV1 } from "@/lib/collab-os";
import { InvitationRejected, recordBusinessAnswer, recordInviteeResponse } from "@/lib/invitation-writes";
import {
  applicationIsInvitation,
  businessOwnsApplication,
  businessTransitionsFor,
  creatorApplicationRole,
  creatorApplicationTransitions,
  creatorOwnsApplication,
  getMarketplaceApplication,
  listWorkspaceBusinessRequests,
  MARKETPLACE_APPLICATION_STATUSES,
  transitionMarketplaceApplication,
  type MarketplaceApplicationStatus,
} from "@/lib/marketplace-listings";

function detailPath(id: string, query = "") {
  return `/collaboration/applications/${id}${query}`;
}

function revalidateApplicationSurfaces(id: string) {
  revalidatePath(detailPath(id));
  revalidatePath("/collaboration/hub");
  revalidatePath("/collaboration/business");
  revalidatePath("/collaboration/requests");
  revalidatePath("/creator");
  revalidatePath("/business/home");
}

/** Role-aware transition from the application detail page only. */
export async function actionTransitionApplicationDetail(formData: FormData) {
  await assertCollabOsV1();
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect(`/login?next=${encodeURIComponent("/collaboration/hub")}`);

  const applicationId = String(formData.get("applicationId") ?? "").trim();
  const toStatus = String(formData.get("toStatus") ?? "").trim() as MarketplaceApplicationStatus;
  if (!applicationId || !(MARKETPLACE_APPLICATION_STATUSES as readonly string[]).includes(toStatus)) {
    redirect(`${detailPath(applicationId || "missing")}?error=${encodeURIComponent("Invalid transition.")}`);
  }

  const existing = await getMarketplaceApplication(applicationId);
  if (!existing) {
    redirect(`/collaboration/hub?error=${encodeURIComponent("Application not found.")}#applications`);
  }

  const draft = await getCreatorSessionDraft().catch(() => null);
  const ws = await getWorkspace(account.id).catch(() => null);
  const ownedIds =
    ws && ws.businessId !== "public"
      ? (await listWorkspaceBusinessRequests(ws.businessId)).map((row) => row.id)
      : [];

  const asBusiness = businessOwnsApplication(existing, ownedIds, ws?.briefs.map((brief) => brief.id) ?? []);
  const asCreator = draft?.slug ? creatorOwnsApplication(existing, draft.slug) : false;
  const creatorRole = draft?.slug ? creatorApplicationRole(existing, draft.slug) : null;

  if (!asBusiness && !asCreator) {
    redirect(
      `${detailPath(applicationId)}?error=${encodeURIComponent("You cannot manage this application.")}`,
    );
  }

  const allowed = asBusiness
    ? businessTransitionsFor(existing)
    : creatorRole
      ? creatorApplicationTransitions(existing.status, creatorRole)
      : [];

  if (!allowed.includes(toStatus)) {
    redirect(
      `${detailPath(applicationId)}?error=${encodeURIComponent(
        "Open this application and review the details before taking that action.",
      )}`,
    );
  }

  if (asBusiness && ws && toStatus === "COLLABORATION_DRAFTED") {
    const slug = (existing.creatorSlug ?? "").trim();
    const shortlisted = ws.shortlist.some((item) => item.creatorSlug === slug);
    if (!shortlisted) {
      redirect(
        `${detailPath(applicationId)}?error=${encodeURIComponent(
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
    revalidateApplicationSurfaces(applicationId);
  } catch (error) {
    if (isNavigationError(error)) throw error;
    redirect(
      `${detailPath(applicationId)}?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Transition failed.",
      )}`,
    );
  }

  if (toStatus === "COLLABORATION_DRAFTED" && asBusiness && ws) {
    const creator = updated.toSlug || updated.fromSlug;
    const brief = updated.briefId ? ws.briefs.find((item) => item.id === updated.briefId) ?? null : null;
    if (creator) {
      redirect(
        contractHrefFromCampaign({
          creatorSlug: creator,
          brief,
          collaborationId: updated.collaborationId,
          applicationId: updated.id,
        }),
      );
    }
  }

  if (toStatus === "COLLABORATION_DRAFTED" && asCreator && draft?.slug) {
    redirect("/collaboration/contracts");
  }

  redirect(`${detailPath(applicationId)}?app=${encodeURIComponent(toStatus)}`);
}

const HUB_INVITATIONS = "/collaboration/hub?view=collaborations&tab=invitations";

/** Where to send the user back to: only same-origin influencer/collaboration paths. */
function safeReturn(value: FormDataEntryValue | null, fallback: string) {
  const path = String(value ?? "").trim();
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  if (!path.startsWith("/collaboration/") && !path.startsWith("/creator")) return fallback;
  return path.split("#")[0];
}

function withParam(path: string, key: string, value: string) {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

/**
 * Invitee response from the popup or the detail page (P1-AUD-10: one rule set).
 * The §2.2b matrix decides what is allowed; the server rejects anything else. Never accepts work.
 */
export async function actionRespondToInvitation(formData: FormData) {
  await assertCollabOsV1();
  const applicationId = String(formData.get("applicationId") ?? "").trim();
  const itemPath = `/collaboration/applications/${applicationId || "missing"}`;
  const returnTo = safeReturn(formData.get("returnTo"), itemPath);
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect(`/login?next=${encodeURIComponent(itemPath)}`);
  const intent = String(formData.get("intent") ?? "").trim();
  if (intent !== "interested" && intent !== "question" && intent !== "decline") {
    redirect(withParam(returnTo, "error", "Choose a response."));
  }
  const existing = applicationId ? await getMarketplaceApplication(applicationId) : null;
  if (!existing || !applicationIsInvitation(existing)) redirect(withParam(HUB_INVITATIONS, "error", "Invitation not found."));
  const draft = await getCreatorSessionDraft().catch(() => null);
  const creatorRole = draft?.slug ? creatorApplicationRole(existing, draft.slug) : null;
  if (!draft?.slug || creatorRole !== "invitee" || !creatorOwnsApplication(existing, draft.slug)) {
    redirect(withParam(HUB_INVITATIONS, "error", "You cannot respond to this invitation."));
  }
  try {
    await recordInviteeResponse({
      id: applicationId,
      actorUserId: account.id,
      intent,
      note: String(formData.get("note") ?? ""),
    });
  } catch (error) {
    if (isNavigationError(error)) throw error;
    revalidateApplicationSurfaces(applicationId);
    const message = error instanceof InvitationRejected ? error.message : "We couldn't confirm your response. Try again.";
    redirect(withParam(withParam(returnTo, "invitation", applicationId), "error", message));
  }
  revalidateApplicationSurfaces(applicationId);
  redirect(withParam(withParam(returnTo, "invitation", applicationId), "responded", intent));
}

/** Business answers the invitee's open question (§2.2b case 2 → 3, case 5 → 6). */
export async function actionAnswerInvitationQuestion(formData: FormData) {
  await assertCollabOsV1();
  const applicationId = String(formData.get("applicationId") ?? "").trim();
  const itemPath = detailPath(applicationId || "missing");
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect(`/login?next=${encodeURIComponent(itemPath)}`);
  const existing = applicationId ? await getMarketplaceApplication(applicationId) : null;
  if (!existing || !applicationIsInvitation(existing)) redirect(withParam("/collaboration/business", "error", "Invitation not found."));
  const ws = await getWorkspace(account.id).catch(() => null);
  const ownedIds =
    ws && ws.businessId !== "public" ? (await listWorkspaceBusinessRequests(ws.businessId)).map((row) => row.id) : [];
  if (!businessOwnsApplication(existing, ownedIds, ws?.briefs.map((brief) => brief.id) ?? [])) {
    redirect(withParam(itemPath, "error", "You cannot manage this invitation."));
  }
  try {
    await recordBusinessAnswer({ id: applicationId, actorUserId: account.id, answer: String(formData.get("answer") ?? "") });
  } catch (error) {
    if (isNavigationError(error)) throw error;
    revalidateApplicationSurfaces(applicationId);
    redirect(withParam(itemPath, "error", error instanceof InvitationRejected ? error.message : "We couldn't confirm your answer. Try again."));
  }
  revalidateApplicationSurfaces(applicationId);
  redirect(withParam(itemPath, "answered", "1"));
}

function isNavigationError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}
