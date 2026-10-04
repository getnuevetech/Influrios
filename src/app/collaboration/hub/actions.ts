"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { getCreatorSessionDraft } from "@/lib/claim";
import { assertCollabOsV1 } from "@/lib/collab-os";
import { consumeGuestQuota } from "@/lib/guest-usage";
import {
  createMarketplaceApplication,
  MARKETPLACE_APPLICATION_STATUSES,
  transitionMarketplaceApplication,
  type MarketplaceApplicationStatus,
} from "@/lib/marketplace-listings";

const HUB = "/collaboration/hub";

function revalidateCreatorSurfaces() {
  revalidatePath(HUB);
  revalidatePath("/collaboration");
  revalidatePath("/collaboration/business");
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
  if (!requestId) {
    redirect(`${HUB}?error=${encodeURIComponent("Choose a business request to apply to.")}#business-requests`);
  }
  await createMarketplaceApplication({
    kind: "business_request",
    businessRequestId: requestId,
    fromUserId: account.id,
    fromSlug: draft.slug,
    note: note || `Application from ${draft.slug}`,
  });
  revalidateCreatorSurfaces();
  redirect(`${HUB}?applied=1#applications`);
}

/** W2.3c — creator advances or withdraws their marketplace application. */
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
  try {
    const updated = await transitionMarketplaceApplication({
      id: applicationId,
      toStatus,
      actorUserId: account.id,
      note: String(formData.get("note") ?? "") || undefined,
    });
    revalidateCreatorSurfaces();
    if (toStatus === "COLLABORATION_DRAFTED") {
      redirect(`/collaboration/contract?creator=${encodeURIComponent(draft.slug)}`);
    }
    void updated;
    redirect(`${HUB}?app=${encodeURIComponent(toStatus)}#applications`);
  } catch (error) {
    redirect(
      `${HUB}?error=${encodeURIComponent(error instanceof Error ? error.message : "Transition failed.")}#applications`,
    );
  }
}
