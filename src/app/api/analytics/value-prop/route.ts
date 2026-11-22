import { NextResponse } from "next/server";
import { recordValuePropPillarClick } from "@/lib/value-proposition";
import { clientIpFrom } from "@/lib/client-ip";

/** Anonymous click counter: cap each address so the counts cannot be inflated. */
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 30;
const recent = new Map<string, { count: number; start: number }>();
function allowed(ip: string, now = Date.now()) {
  if (recent.size > 5000) recent.clear();
  const bucket = recent.get(ip);
  if (!bucket || now - bucket.start > WINDOW_MS) {
    recent.set(ip, { count: 1, start: now });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= MAX_PER_WINDOW;
}

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!allowed(clientIpFrom(request.headers))) return NextResponse.json({ ok: false }, { status: 429 });
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
  if (!pillarKey || !/^[a-z0-9_-]{1,64}$/i.test(pillarKey)) return NextResponse.json({ ok: false }, { status: 400 });
  await recordValuePropPillarClick({ pillarKey, linkUrl, title });
  return NextResponse.json({ ok: true });
}
