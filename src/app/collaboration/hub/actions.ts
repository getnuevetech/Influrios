"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { getCreatorSessionDraft } from "@/lib/claim";
import { assertCollabOsV1 } from "@/lib/collab-os";
import { consumeGuestQuota } from "@/lib/guest-usage";
import { enteredNote } from "@/lib/business";
import {
  createMarketplaceApplication,
  toggleSavedListing,
  creatorApplicationRole,
  creatorApplicationTransitions,
  creatorOwnsApplication,
  getMarketplaceApplication,
  MARKETPLACE_APPLICATION_STATUSES,
  transitionMarketplaceApplication,
  type MarketplaceApplicationStatus,
} from "@/lib/marketplace-listings";

const HUB = "/collaboration/hub";

function revalidateCreatorSurfaces() {
  revalidatePath(HUB);
  revalidatePath("/collaboration");
  revalidatePath("/collaboration/requests");
  revalidatePath("/collaboration/business");
  revalidatePath("/creator");
}

/** W2.3c — creator applies to a published business request. */
export async function actionApplyToBusinessRequest(formData: FormData) {
  await assertCollabOsV1();
  const account = await getAccountSession().catch(() => null);
  if (!account) {
    const gate = await consumeGuestQuota("apply");
    redirect(
      `/login?next=${encodeURIComponent("/collaboration/hub#business-requests")}&gate=${
        gate.decision === "hard" ? "apply" : "apply"
      }`,
    );
  }
  const draft = await getCreatorSessionDraft().catch(() => null);
  if (!draft?.slug) {
    redirect(`/claim?next=${encodeURIComponent(HUB)}`);
  }
  const requestId = String(formData.get("requestId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const returnRaw = String(formData.get("returnTo") ?? "").trim();
  const returnTo =
    returnRaw.startsWith("/collaboration/requests/") && !returnRaw.includes("//")
      ? returnRaw.slice(0, 200)
      : null;
  if (!requestId) {
    redirect(
      `${returnTo ?? HUB}?error=${encodeURIComponent("Choose a business request to apply to.")}${
        returnTo ? "" : "#business-requests"
      }`,
    );
  }
  try {
    await createMarketplaceApplication({
      kind: "business_request",
      businessRequestId: requestId,
      fromUserId: account.id,
      fromSlug: draft.slug,
      note: enteredNote(note),
    });
  } catch (error) {
    redirect(
      `${returnTo ?? HUB}?error=${encodeURIComponent(error instanceof Error ? error.message : "Apply failed.")}${
        returnTo ? "" : "#business-requests"
      }`,
    );
  }
  revalidateCreatorSurfaces();
  redirect(returnTo ? `${returnTo}?applied=1` : `${HUB}?view=opportunities&applied=1`);
}

/** Bookmark a campaign or opening on Opportunities → Saved. */
export async function actionToggleSavedListing(formData: FormData) {
  await assertCollabOsV1();
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect(`/login?next=${encodeURIComponent(`${HUB}?view=opportunities`)}&gate=save`);
  const kind = String(formData.get("kind") ?? "");
  const listingId = String(formData.get("listingId") ?? "").trim();
  const returnRaw = String(formData.get("returnTo") ?? "");
  const returnTo =
    returnRaw.startsWith("/collaboration/hub?") && !returnRaw.includes("//")
      ? returnRaw.slice(0, 300)
      : `${HUB}?view=opportunities&tab=saved`;
  if (kind !== "business_request" && kind !== "creator_opportunity") {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${encodeURIComponent("Choose a listing to save.")}`);
  }
  if (!listingId) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}error=${encodeURIComponent("Choose a listing to save.")}`);
  }
  await toggleSavedListing({ userId: account.id, kind, listingId });
  revalidateCreatorSurfaces();
  redirect(returnTo);
}

/** W2.3c — creator connects/applies to a published creator opportunity. */
export async function actionApplyToCreatorOpportunity(formData: FormData) {
  await assertCollabOsV1();
  const account = await getAccountSession().catch(() => null);
  if (!account) {
    const gate = await consumeGuestQuota("apply");
    redirect(
      `/login?next=${encodeURIComponent("/collaboration/hub")}&gate=${
        gate.decision === "hard" ? "apply" : "apply"
      }`,
    );
  }
  const draft = await getCreatorSessionDraft().catch(() => null);
  if (!draft?.slug) {
    redirect(`/claim?next=${encodeURIComponent(HUB)}`);
  }
  const opportunityId = String(formData.get("opportunityId") ?? "").trim();
  const toSlug = String(formData.get("toSlug") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!opportunityId) {
    redirect(`${HUB}?error=${encodeURIComponent("Choose an opportunity to connect.")}`);
  }
  try {
    await createMarketplaceApplication({
      kind: "creator_opportunity",
      opportunityId,
      fromUserId: account.id,
      fromSlug: draft.slug,
      toSlug: toSlug || undefined,
      note: enteredNote(note),
    });
  } catch (error) {
    redirect(
      `${HUB}?error=${encodeURIComponent(error instanceof Error ? error.message : "Connect failed.")}`,
    );
  }
  revalidateCreatorSurfaces();
  redirect(`${HUB}?view=opportunities&applied=1`);
}

/** W2.3c — creator advances or withdraws an application they own. */
export async function actionCreatorTransitionApplication(formData: FormData) {
  await assertCollabOsV1();
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect(`/login?next=${encodeURIComponent(HUB)}`);
  const draft = await getCreatorSessionDraft().catch(() => null);
  if (!draft?.slug) redirect("/claim");
  const applicationId = String(formData.get("applicationId") ?? "").trim();
  const toStatus = String(formData.get("toStatus") ?? "").trim() as MarketplaceApplicationStatus;
  if (!applicationId || !(MARKETPLACE_APPLICATION_STATUSES as readonly string[]).includes(toStatus)) {
    redirect(`${HUB}?error=${encodeURIComponent("Invalid application transition.")}#applications`);
  }
  const existing = await getMarketplaceApplication(applicationId);
  if (!existing || !creatorOwnsApplication(existing, draft.slug)) {
    redirect(`${HUB}?error=${encodeURIComponent("You can only manage your own applications.")}#applications`);
  }
  const role = creatorApplicationRole(existing, draft.slug);
  const allowed = role ? creatorApplicationTransitions(existing.status, role) : [];
  if (!allowed.includes(toStatus)) {
    redirect(
      `/collaboration/applications/${applicationId}?error=${encodeURIComponent(
        "Open this invitation to review details before taking that action.",
      )}`,
    );
  }
  try {
    await transitionMarketplaceApplication({
      id: applicationId,
      toStatus,
      actorUserId: account.id,
      note: String(formData.get("note") ?? "") || undefined,
    });
    revalidateCreatorSurfaces();
    if (toStatus === "COLLABORATION_DRAFTED") {
      redirect("/collaboration/contracts");
    }
    redirect(`/collaboration/applications/${applicationId}?app=${encodeURIComponent(toStatus)}`);
  } catch (error) {
    redirect(
      `/collaboration/applications/${applicationId}?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Transition failed.",
      )}`,
    );
  }
}
