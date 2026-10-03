import { NextRequest, NextResponse } from "next/server";
import { verifyMarketplaceSignature } from "@/lib/ledger";
import { applyMarketplaceEvent, marketplaceWebhookSecret } from "@/lib/marketplace-ledger";
import { createMarketplaceSignedWebhookAdapter } from "@/lib/payment-provider-adapter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const adapter = createMarketplaceSignedWebhookAdapter({
  verifySignature: verifyMarketplaceSignature,
});

/**
 * Provider confirmation for a prefund or payout. A missing signature or a
 * provider that is not ready does not move the ledger.
 * Routed through PaymentProviderAdapter (Collab OS P4) so domain rules stay provider-agnostic.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const headerProvider = request.headers.get("x-influrios-provider")?.trim().toLowerCase() ?? "";
  const parsed = adapter.parseWebhook(body, headerProvider);
  if ("error" in parsed) {
    const status = parsed.error === "Invalid JSON." ? 400 : 400;
    return NextResponse.json({ error: parsed.error }, { status });
  }
  const ready = await marketplaceWebhookSecret(parsed.provider).catch(() => ({ error: "not_ready" as const }));
  if ("error" in ready) {
    const missing = ready.error === "missing";
    return NextResponse.json(
      { error: missing ? "Unknown marketplace provider." : "Marketplace provider is not ready." },
      { status: missing ? 404 : 503 },
    );
  }
  const signature = request.headers.get("x-influrios-signature");
  if (!adapter.verifyWebhook(body, signature, ready.secret)) {
    return NextResponse.json({ error: "Signature did not match." }, { status: 401 });
  }
  const result = await applyMarketplaceEvent({
    provider: ready.code,
    eventId: parsed.eventId,
    eventType: parsed.eventType,
    fundingId: parsed.fundingId,
    amountCents: parsed.amountCents,
    milestoneId: parsed.milestoneId,
  });
  return NextResponse.json(result);
}
