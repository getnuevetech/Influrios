import { NextResponse } from "next/server";
import { oauthAppOrigin } from "@/lib/billing";
import { launchSocialAuthorize } from "@/lib/social-connect";
import { describeTikTokAuthorizeUrl, providerLaunchDocument } from "@/lib/social-sync";

export const dynamic = "force-dynamic";

function failure(origin: string, message: string) {
  return NextResponse.redirect(new URL(`/dashboard/social?error=${encodeURIComponent(message)}`, origin));
}

/**
 * One browser navigation to the provider. A Location header is not used for TikTok:
 * a comma in that header can drop the query, and TikTok then loops on
 * /v2/auth/authorize/&error=invalid_request with no "?".
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const origin = oauthAppOrigin({
    proto: request.headers.get("x-forwarded-proto"),
    host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
  });
  const result = await launchSocialAuthorize({ state, origin });
  if (!result.ok) return failure(origin, result.error);
  let destination = result.authorizeUrl;
  try {
    const parsed = new URL(destination);
    if (parsed.hostname === "www.tiktok.com") {
      const described = describeTikTokAuthorizeUrl(destination);
      if (!described.ok) return failure(origin, described.error);
      destination = described.url;
    }
  } catch {
    return failure(origin, "The network login URL could not be opened. Nothing was retried.");
  }
  return new NextResponse(providerLaunchDocument(destination), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
