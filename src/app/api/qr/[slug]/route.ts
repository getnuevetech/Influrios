import { NextRequest, NextResponse } from "next/server";
import { buildBrandedQrSvg } from "@/lib/branded-qr";
import { getCreatorBySlug } from "@/lib/seed-data";
import { getEntitlements, type PlanCode } from "@/lib/entitlements";

/**
 * Dynamic / standard QR for Influencer Cards.
 * Pro: opaque token-style URL (/q/{slug}) — content can change without reprinting.
 * Plus: direct card URL.
 * Starter: 403 — no QR entitlement.
 *
 * Query: size (px, default 512), logo=0 to omit center Influrios mark.
 * Response: SVG in primary electric blue (#2979FF).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const creator = getCreatorBySlug(slug);
  if (!creator) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const entitlements = getEntitlements(creator.planTier as PlanCode);
  if (!entitlements.standardQr && !entitlements.dynamicQr) {
    return NextResponse.json({ error: "QR not included on Starter" }, { status: 403 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  const target = entitlements.dynamicQr
    ? `${appUrl}/q/${creator.slug}`
    : `${appUrl}/c/${creator.slug}`;

  const sizeRaw = Number(request.nextUrl.searchParams.get("size") || 512);
  const size = Number.isFinite(sizeRaw) ? Math.min(1024, Math.max(64, Math.round(sizeRaw))) : 512;
  const logoParam = request.nextUrl.searchParams.get("logo");
  const withLogo = logoParam === "0" ? false : logoParam === "1" ? true : size >= 120;

  const svg = await buildBrandedQrSvg({ target, size, withLogo, margin: 1 });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
