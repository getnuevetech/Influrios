import { NextRequest, NextResponse } from "next/server";
import { buildBrandedQrSvg } from "@/lib/branded-qr";
import { getDirectoryCreator } from "@/lib/directory";
import { entitlementsForPlan } from "@/lib/entitlements-db";
import { qrPayloadForSlug } from "@/lib/short-link";

/**
 * QR image for an Influencer Card.
 * The payload is always the opaque short-domain identity (https://inflr.me/q/{token}
 * or the admin-selected primary domain). It is never the canonical profile URL.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const creator = await getDirectoryCreator(slug);
  if (!creator) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const entitlements = await entitlementsForPlan(creator.planTier);
  if (!entitlements.standardQr && !entitlements.dynamicQr) {
    return NextResponse.json({ error: "QR not included on Starter" }, { status: 403 });
  }

  const target = await qrPayloadForSlug(creator.slug);
  if (!target) {
    return NextResponse.json({ error: "QR identity is not available for this card" }, { status: 404 });
  }

  const sizeRaw = Number(request.nextUrl.searchParams.get("size") || 512);
  const size = Number.isFinite(sizeRaw) ? Math.min(1024, Math.max(64, Math.round(sizeRaw))) : 512;
  const logoParam = request.nextUrl.searchParams.get("logo");
  const withLogo = logoParam === "0" ? false : logoParam === "1" ? true : size >= 120;

  const svg = await buildBrandedQrSvg({ target, size, withLogo, margin: 1 });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}
