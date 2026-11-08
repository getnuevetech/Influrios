import { NextResponse } from "next/server";
import { oauthAppOrigin } from "@/lib/billing";
import { launchSocialAuthorize } from "@/lib/social-connect";

export const dynamic = "force-dynamic";

/** 302 to the provider. A server-action redirect rewrites the query TikTok compares. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const origin = oauthAppOrigin({
    proto: request.headers.get("x-forwarded-proto"),
    host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
  });
  const result = await launchSocialAuthorize({ state, origin });
  if (!result.ok) {
    return NextResponse.redirect(
      new URL(`/dashboard/social?error=${encodeURIComponent(result.error)}`, origin),
    );
  }
  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: result.authorizeUrl,
      "Cache-Control": "no-store",
    },
  });
}
