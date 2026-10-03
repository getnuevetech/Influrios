"use server";

import { redirect } from "next/navigation";
import { getAccountSession } from "@/lib/accounts";
import { safeNextPath } from "@/lib/account-policy";
import { scoreCreatorPair } from "@/lib/matching";
import { getDirectoryCreator } from "@/lib/directory";
import { saveMatchForUser } from "@/lib/marketplace-listings";

export async function actionSaveMatch(formData: FormData) {
  const partyASlug = String(formData.get("partyASlug") ?? "").trim();
  const partyBSlug = String(formData.get("partyBSlug") ?? "").trim();
  const next = safeNextPath(String(formData.get("next") ?? "/collaboration"), "/collaboration");
  const account = await getAccountSession();
  if (!account) {
    const loginNext = `/collaboration?save=${encodeURIComponent(`${partyASlug}:${partyBSlug}`)}`;
    redirect(`/login?next=${encodeURIComponent(loginNext)}&gate=save`);
  }
  if (!partyASlug || !partyBSlug) {
    redirect(`${next}${next.includes("?") ? "&" : "?"}error=${encodeURIComponent("Missing match parties")}`);
  }

  const [creatorA, creatorB] = await Promise.all([
    getDirectoryCreator(partyASlug),
    getDirectoryCreator(partyBSlug),
  ]);
  if (!creatorA || !creatorB) {
    redirect(`${next}${next.includes("?") ? "&" : "?"}error=${encodeURIComponent("Influencers not found")}`);
  }

  const match = scoreCreatorPair(creatorA, creatorB);
  if (!match) {
    redirect(`${next}${next.includes("?") ? "&" : "?"}error=${encodeURIComponent("Could not score match")}`);
  }

  await saveMatchForUser({
    match,
    userId: account.id,
  });

  redirect(next);
}
