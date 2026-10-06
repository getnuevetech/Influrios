import { NextRequest, NextResponse } from "next/server";
import { verifyMarketplaceSignature } from "@/lib/ledger";
import { applyAirwallexMentorshipWebhook } from "@/lib/mentorship";
import { applyMarketplaceEvent, marketplaceWebhookSecret } from "@/lib/marketplace-ledger";
import { createMarketplaceSignedWebhookAdapter } from "@/lib/payment-provider-adapter";
import { applyRegionalCharge, gatewayWebhookSecret, readRegionalWebhook } from "@/lib/providers/regional-charge";

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
async function regionalResponse(provider: "flutterwave" | "mpesa", body: string, signature: string | null) {
  const ready = await gatewayWebhookSecret(provider).catch(() => ({ error: "not_ready" as const }));
  if ("error" in ready) {
    return NextResponse.json({ error: "Marketplace provider is not ready." }, { status: 503 });
  }
  const read = readRegionalWebhook(provider, body, signature, ready.secret);
  if (!read.ok) return NextResponse.json({ error: read.error }, { status: read.status });
  const result = await applyRegionalCharge(read.charge);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headerProvider = request.headers.get("x-influrios-provider")?.trim().toLowerCase() ?? "";
  const verifHash = request.headers.get("verif-hash");
  const mpesaSig = request.headers.get("x-mpesa-signature");
  if (verifHash || headerProvider === "flutterwave") {
    return regionalResponse("flutterwave", body, verifHash || request.headers.get("x-influrios-signature"));
  }
  if (mpesaSig || headerProvider === "mpesa") {
    return regionalResponse("mpesa", body, mpesaSig || request.headers.get("x-influrios-signature"));
  }
  if (headerProvider === "airwallex") {
    const signature = request.headers.get("x-airwallex-signature") || request.headers.get("x-influrios-signature");
    const mentorship = await applyAirwallexMentorshipWebhook(body, signature);
    if (!mentorship.fallThrough) {
      return NextResponse.json(mentorship.ok ? mentorship : { error: mentorship.error }, {
        status: mentorship.ok ? 200 : mentorship.status,
      });
    }
  }
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
