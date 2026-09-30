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
  const headerProvider = request.headers.get("x-influrios-provider")?.trim().toLowerCase() ?? "";
  const code = (payload.provider || headerProvider || "primary").trim().toLowerCase();
  const ready = await marketplaceWebhookSecret(code).catch(() => ({ error: "not_ready" as const }));
  if ("error" in ready) {
    const missing = ready.error === "missing";
    return NextResponse.json(
      { error: missing ? "Unknown marketplace provider." : "Marketplace provider is not ready." },
      { status: missing ? 404 : 503 },
    );
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
