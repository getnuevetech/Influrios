"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { hasCurrentLegalRecord, recordLegalEvent } from "@/lib/legal";
import {
  addToShortlist,
  createBrief,
  ensureOwnedBusinessWorkspace,
  getWorkspace,
  removeFromShortlist,
  requestManagedMatch,
  sendInquiry,
  setBusinessPlan,
} from "@/lib/business";
import type { BusinessPlanCode } from "@/lib/business-entitlements";

const BASE = "/business/workspace";

async function requireBusinessAccount() {
  const account = await getAccountSession().catch(() => null);
  if (!account) redirect(`/login?next=${BASE}`);
  const accepted = await hasCurrentLegalRecord({
    documentKey: "business-terms",
    userId: account.id,
  }).catch(() => true);
  if (!accepted) {
    redirect(`${BASE}?error=` + encodeURIComponent("Agree to the Business / Brand Terms before using the workspace."));
  }
  const ws = await getWorkspace(account.id);
  return { account, ws };
}

export async function actionAcceptBusinessTerms(formData: FormData) {
  if (formData.get("acceptBusiness") !== "on") {
    redirect(`${BASE}?error=` + encodeURIComponent("Agree to the Business / Brand Terms to continue."));
  }
  const account = await getAccountSession();
  if (!account) redirect(`/login?next=${BASE}`);
  if (await hasCurrentLegalRecord({ documentKey: "business-terms", userId: account.id })) {
    await ensureOwnedBusinessWorkspace(account.id);
    redirect(`${BASE}?terms=1`);
  }
  await recordLegalEvent({
    trigger: "business_registration",
    context: "business_registration",
    userId: account.id,
    userRole: "BUSINESS",
    extraKeys: ["terms-of-service", "privacy-policy"],
  });
  await ensureOwnedBusinessWorkspace(account.id);
  redirect(`${BASE}?terms=1`);
}

export async function actionAddShortlist(formData: FormData) {
  const { ws } = await requireBusinessAccount();
  const slug = String(formData.get("slug") ?? "");
  const note = String(formData.get("note") ?? "") || undefined;
  const result = await addToShortlist(slug, note, ws.businessId);
  revalidatePath(BASE);
  revalidatePath(`/creators/${slug}`);
  if (!result.ok) {
    redirect(`${BASE}?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`${BASE}?added=${encodeURIComponent(slug)}`);
}

export async function actionRemoveShortlist(formData: FormData) {
  const { ws } = await requireBusinessAccount();
  const slug = String(formData.get("slug") ?? "");
  await removeFromShortlist(slug, ws.businessId);
  revalidatePath(BASE);
  redirect(BASE);
}

export async function actionCreateBrief(formData: FormData) {
  const { ws } = await requireBusinessAccount();
  await createBrief(
    {
      title: String(formData.get("title") ?? "Untitled brief"),
      goal: String(formData.get("goal") ?? "Brand Awareness"),
      specialty: String(formData.get("specialty") ?? "beauty"),
      budget: String(formData.get("budget") ?? "$1K – $5K"),
      location: [String(formData.get("locationCity") ?? ""), String(formData.get("locationCountry") ?? "")]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(", ") || String(formData.get("location") ?? "USA"),
      platform: String(formData.get("platform") ?? "INSTAGRAM"),
      summary: String(formData.get("summary") ?? ""),
    },
    ws.businessId,
  );
  revalidatePath(BASE);
  redirect(`${BASE}?brief=1`);
}

export async function actionSendInquiry(formData: FormData) {
  const { ws } = await requireBusinessAccount();
  const creatorSlug = String(formData.get("creatorSlug") ?? "");
  const message = String(formData.get("message") ?? "");
  const briefId = String(formData.get("briefId") ?? "") || undefined;
  const result = await sendInquiry({ creatorSlug, message, briefId }, ws.businessId);
  revalidatePath(BASE);
  if (!result.ok) {
    redirect(`${BASE}?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`${BASE}?inquiry=1`);
}

export async function actionSetPlan(formData: FormData) {
  const { ws } = await requireBusinessAccount();
  const plan = String(formData.get("plan") ?? "BUSINESS_FREE") as BusinessPlanCode;
  try {
    await setBusinessPlan(plan, ws.businessId);
  } catch {
    redirect(`${BASE}?error=` + encodeURIComponent("The business workspace is unavailable. Nothing was saved."));
  }
  revalidatePath(BASE);
  redirect(`${BASE}?plan=${plan}`);
}

export async function actionRequestManagedMatch(formData: FormData) {
  const { ws } = await requireBusinessAccount();
  const briefId = String(formData.get("briefId") ?? "");
  let result: Awaited<ReturnType<typeof requestManagedMatch>>;
  try {
    result = await requestManagedMatch(briefId, ws.businessId);
  } catch {
    redirect(`${BASE}?error=` + encodeURIComponent("The business workspace is unavailable. Nothing was saved."));
  }
  revalidatePath(BASE);
  revalidatePath("/admin/matching");
  if (!result.ok) {
    redirect(`${BASE}?error=${encodeURIComponent(result.error)}`);
  }
  redirect(`${BASE}?queued=1`);
}
