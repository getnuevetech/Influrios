import { NextRequest, NextResponse } from "next/server";
import { completeSocialCallback } from "@/lib/social-connect";

function originFrom(request: NextRequest) {
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") ?? undefined;
  const state = request.nextUrl.searchParams.get("state") ?? undefined;
  const providerError = request.nextUrl.searchParams.get("error") ?? undefined;
  try {
    const result = await completeSocialCallback({
      code,
      state,
      error: providerError,
      origin: originFrom(request),
    });
    const target = new URL("/dashboard", request.nextUrl.origin);
    if (result.ok) target.searchParams.set("social", "connected");
    else target.searchParams.set("error", result.error);
    return NextResponse.redirect(target);
  } catch {
    const target = new URL("/dashboard", request.nextUrl.origin);
    target.searchParams.set("error", "The network could not be reached. The profile figures were not changed.");
    return NextResponse.redirect(target);
  }
}
