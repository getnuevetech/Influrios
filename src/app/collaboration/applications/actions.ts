"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { closeBriefForContract, getWorkspace } from "@/lib/business";
import { contractHrefFromCampaign } from "@/lib/campaign-contract";
import { getCreatorSessionDraft } from "@/lib/claim";
import { assertCollabOsV1 } from "@/lib/collab-os";
import {
  businessApplicationTransitions,
  businessOwnsApplication,
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
    ? businessApplicationTransitions(existing.status)
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

  let updated: Awaited<ReturnType<typeof transitionMarketplaceApplication>>;
  try {
    updated = await transitionMarketplaceApplication({
      id: applicationId,
      toStatus,
      actorUserId: account.id,
      note: String(formData.get("note") ?? "") || undefined,
    });
    if (asBusiness && ws && updated.briefId && (toStatus === "ACCEPTED" || toStatus === "COLLABORATION_DRAFTED")) {
      await closeBriefForContract(updated.briefId, ws.businessId).catch(() => undefined);
    }
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
      redirect(contractHrefFromCampaign({ creatorSlug: creator, brief }));
    }
  }

  if (toStatus === "COLLABORATION_DRAFTED" && asCreator && draft?.slug) {
    redirect("/collaboration/contracts");
  }

  redirect(`${detailPath(applicationId)}?app=${encodeURIComponent(toStatus)}`);
}

function isNavigationError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}
