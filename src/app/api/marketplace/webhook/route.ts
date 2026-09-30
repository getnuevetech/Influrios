import { NextRequest, NextResponse } from "next/server";
import { verifyMarketplaceSignature } from "@/lib/ledger";
import { applyMarketplaceEvent, marketplaceWebhookSecret } from "@/lib/marketplace-ledger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Provider confirmation for a prefund or payout. A missing signature or a
 * provider that is not ready does not move the ledger.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  let payload: {
    id?: string;
    type?: string;
    fundingId?: string;
    amountCents?: number;
    milestoneId?: string;
    provider?: string;
  };
  try {
    payload = JSON.parse(body) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const ready = await marketplaceWebhookSecret().catch(() => null);
  if (!ready) return NextResponse.json({ error: "Marketplace provider is not ready." }, { status: 503 });
  if (payload.provider && payload.provider !== ready.code) {
    return NextResponse.json({ error: "Unknown marketplace provider." }, { status: 404 });
  }
  const signature = request.headers.get("x-influrios-signature");
  if (!verifyMarketplaceSignature(body, ready.secret, signature)) {
    return NextResponse.json({ error: "Signature did not match." }, { status: 401 });
  }
  if (!payload.id || !payload.type || !payload.fundingId || payload.amountCents == null) {
    return NextResponse.json({ error: "Event id, type, funding, and amount are required." }, { status: 400 });
  }
  const result = await applyMarketplaceEvent({
    provider: ready.code,
    eventId: payload.id,
    eventType: payload.type,
    fundingId: payload.fundingId,
    amountCents: payload.amountCents,
    milestoneId: payload.milestoneId,
  });
  return NextResponse.json(result);
}
