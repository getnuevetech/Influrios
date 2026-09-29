import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getCreatorBySlug } from "@/lib/seed-data";
import { getEntitlements, type PlanCode } from "@/lib/entitlements";

/**
 * Dynamic / standard QR for Influencer Cards.
 * Pro: opaque token-style URL (ic.me/q/{slug}) — content can change without reprinting.
 * Plus: direct card URL.
 * Starter: 403 — no QR entitlement.
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

  const png = await QRCode.toBuffer(target, {
    type: "png",
    width: 256,
    margin: 1,
    color: { dark: "#111A5A", light: "#FFFFFF" },
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
