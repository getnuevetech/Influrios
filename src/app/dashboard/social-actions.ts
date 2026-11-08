"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { oauthAppOrigin } from "@/lib/billing";
import { getCreatorSessionDraft } from "@/lib/claim";
import { beginSocialConnect, disconnectSocial, refreshSocialConnection } from "@/lib/social-connect";

function isNextRedirect(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

async function origin() {
  const headerList = await headers();
  return oauthAppOrigin({
    proto: headerList.get("x-forwarded-proto") ?? "https",
    host: headerList.get("x-forwarded-host") ?? headerList.get("host"),
  });
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
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    redirect("/dashboard/social?error=" + encodeURIComponent("Social connection is unavailable. Nothing was connected."));
  }
  if (!result.ok) redirect(`/dashboard/social?error=${encodeURIComponent(result.error)}`);
  // Hand the browser a real 302. A server-action redirect splits on ";" and
  // re-parses the URL, which changes the redirect_uri TikTok compares.
  redirect(`/api/social/launch?state=${encodeURIComponent(result.state)}`);
}

export async function actionRefreshSocial(formData: FormData) {
  const slug = await ownedSlug();
  const platform = String(formData.get("platform") ?? "");
  let result: Awaited<ReturnType<typeof refreshSocialConnection>>;
  try {
    result = await refreshSocialConnection({ slug, platform, origin: await origin() });
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    redirect("/dashboard/social?error=" + encodeURIComponent("The network could not be reached. The profile figures were not changed."));
  }
  if (!result.ok) redirect(`/dashboard/social?error=${encodeURIComponent(result.error)}`);
  redirect("/dashboard/social?social=synced");
}

export async function actionDisconnectSocial(formData: FormData) {
  const slug = await ownedSlug();
  const platform = String(formData.get("platform") ?? "");
  let result: Awaited<ReturnType<typeof disconnectSocial>>;
  try {
    result = await disconnectSocial({ slug, platform });
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    redirect("/dashboard/social?error=" + encodeURIComponent("Social connection is unavailable. Nothing was disconnected."));
  }
  if (!result.ok) redirect(`/dashboard/social?error=${encodeURIComponent(result.error)}`);
  redirect("/dashboard/social?social=disconnected");
}
