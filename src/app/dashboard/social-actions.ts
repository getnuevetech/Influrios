"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCreatorSessionDraft } from "@/lib/claim";
import { beginSocialConnect, disconnectSocial, refreshSocialConnection } from "@/lib/social-connect";

async function origin() {
  const headerList = await headers();
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "127.0.0.1:3000";
  return `${proto}://${host}`;
}

async function ownedSlug() {
  const draft = await getCreatorSessionDraft();
  if (!draft) redirect("/claim");
  return draft.slug;
}

export async function actionConnectSocial(formData: FormData) {
  const slug = await ownedSlug();
  const platform = String(formData.get("platform") ?? "");
  let result: Awaited<ReturnType<typeof beginSocialConnect>>;
  try {
    result = await beginSocialConnect({
      slug,
      platform,
      accepted: formData.get("acceptTerms") === "on",
      origin: await origin(),
    });
  } catch {
    redirect("/dashboard?error=" + encodeURIComponent("Social connection is unavailable. Nothing was connected."));
  }
  if (!result.ok) redirect(`/dashboard?error=${encodeURIComponent(result.error)}`);
  redirect(result.authorizeUrl);
}

export async function actionRefreshSocial(formData: FormData) {
  const slug = await ownedSlug();
  const platform = String(formData.get("platform") ?? "");
  try {
    const result = await refreshSocialConnection({ slug, platform, origin: await origin() });
    if (!result.ok) redirect(`/dashboard?error=${encodeURIComponent(result.error)}`);
  } catch {
    redirect("/dashboard?error=" + encodeURIComponent("The network could not be reached. The profile figures were not changed."));
  }
  redirect("/dashboard?social=synced");
}

export async function actionDisconnectSocial(formData: FormData) {
  const slug = await ownedSlug();
  const platform = String(formData.get("platform") ?? "");
  try {
    const result = await disconnectSocial({ slug, platform });
    if (!result.ok) redirect(`/dashboard?error=${encodeURIComponent(result.error)}`);
  } catch {
    redirect("/dashboard?error=" + encodeURIComponent("Social connection is unavailable. Nothing was disconnected."));
  }
  redirect("/dashboard?social=disconnected");
}
