import { NextResponse } from "next/server";
import { recordValuePropPillarClick } from "@/lib/value-proposition";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let pillarKey = "";
  let linkUrl = "";
  let title = "";
  try {
    const payload = (await request.json()) as {
      pillarKey?: string;
      linkUrl?: string;
      title?: string;
    };
    pillarKey = String(payload.pillarKey ?? "").trim();
    linkUrl = String(payload.linkUrl ?? "").trim();
    title = String(payload.title ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!pillarKey) return NextResponse.json({ ok: false }, { status: 400 });
  await recordValuePropPillarClick({ pillarKey, linkUrl, title });
  return NextResponse.json({ ok: true });
}
