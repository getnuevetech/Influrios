import { NextRequest, NextResponse } from "next/server";
import { brandedFallbackHtml, resolveShortRequest } from "@/lib/short-link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lightweight short-link resolver. It does not render the Influrios frontend.
 * Destination redirects are 302 + no-store. Alias-to-current-slug redirects are 301.
 */
export async function GET(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const path = request.nextUrl.searchParams.get("path") || "/";
  try {
    const hit = await resolveShortRequest(host, path);
    if (hit.kind === "redirect") {
      return NextResponse.redirect(hit.location, {
        status: hit.status,
        headers: { "Cache-Control": hit.cacheControl },
      });
    }
    return new NextResponse(brandedFallbackHtml(hit.title, hit.message), {
      status: hit.status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("short link resolve", error);
    return new NextResponse(
      brandedFallbackHtml("Influrios", "This short link could not be resolved right now."),
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      },
    );
  }
}
