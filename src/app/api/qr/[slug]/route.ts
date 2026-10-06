import { NextRequest, NextResponse } from "next/server";
import { buildBrandedQrSvg } from "@/lib/branded-qr";
import { getDraftBySlug } from "@/lib/claim";
import { getDirectoryCreator } from "@/lib/directory";
import { entitlementsForPlan } from "@/lib/entitlements-db";
import { qrPayloadForSlug } from "@/lib/short-link";

function appOrigin(request: NextRequest) {
  const env = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (env) return env;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`.replace(/\/$/, "");
  return "https://influrios.com";
}

/**
 * QR image for an Influencer Card.
 * Published cards encode the opaque short-domain identity (https://inflr.me/q/{token}).
 * Unpublished claim drafts get a temporary QR that points at the claim preview URL
 * so the signup card is not a broken image.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const sizeRaw = Number(request.nextUrl.searchParams.get("size") || 512);
  const size = Number.isFinite(sizeRaw) ? Math.min(1024, Math.max(64, Math.round(sizeRaw))) : 512;
  const logoParam = request.nextUrl.searchParams.get("logo");
  const withLogo = logoParam === "0" ? false : logoParam === "1" ? true : size >= 120;

  const creator = await getDirectoryCreator(slug);
  if (creator) {
    const entitlements = await entitlementsForPlan(creator.planTier);
    if (!entitlements.standardQr && !entitlements.dynamicQr) {
      return NextResponse.json({ error: "QR not included on Starter" }, { status: 403 });
    }

    const target = await qrPayloadForSlug(creator.slug);
    if (!target) {
      return NextResponse.json({ error: "QR identity is not available for this card" }, { status: 404 });
    }

    const svg = await buildBrandedQrSvg({ target, size, withLogo, margin: 1 });
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
    });
  }

  const draft = await getDraftBySlug(slug);
  if (!draft || draft.stage === "published") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const target = `${appOrigin(request)}/claim/preview/${draft.id}`;
  const svg = await buildBrandedQrSvg({ target, size, withLogo, margin: 1 });
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
