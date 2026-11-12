import { NextRequest, NextResponse } from "next/server";
import { verifyMarketplaceSignature } from "@/lib/ledger";
import { applyIntroFeeFromWebhook } from "@/lib/managed-matching";
import { applyAirwallexMentorshipWebhook } from "@/lib/mentorship";
import { airwallexEnvironment, loadAirwallexConfig } from "@/lib/providers/airwallex-config";
import { prisma } from "@/lib/db";
import { releasableCents } from "@/lib/ledger";
import {
  parseAirwallexIntroFeeWebhook,
  parseAirwallexWebhook,
  verifyAirwallexSignature,
  verifyAirwallexWebhook,
} from "@/lib/providers/airwallex";
import { applyMarketplaceEvent, marketplaceWebhookSecret } from "@/lib/marketplace-ledger";
import { providerLedgerAdvance } from "@/lib/payment-engine";
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
  const nativeSignature = request.headers.get("x-signature");
  const nativeTimestamp = request.headers.get("x-timestamp");
  const airwallexSig = request.headers.get("x-airwallex-signature");
  if (nativeSignature || nativeTimestamp || airwallexSig || headerProvider === "airwallex") {
    const signature = nativeSignature || airwallexSig || request.headers.get("x-influrios-signature");
    const mentorship = await applyAirwallexMentorshipWebhook(body, signature, nativeTimestamp);
    if (!mentorship.fallThrough) {
      return NextResponse.json(mentorship.ok ? mentorship : { error: mentorship.error }, {
        status: mentorship.ok ? 200 : mentorship.status,
      });
    }
    const settings = await loadAirwallexConfig().catch(() => null);
    if (!settings?.webhookSecret) {
      return NextResponse.json({ error: "Airwallex is not ready." }, { status: 503 });
    }
    if (nativeSignature || nativeTimestamp) {
      const checked = verifyAirwallexWebhook({
        body,
        signature,
        timestamp: nativeTimestamp,
        secret: settings.webhookSecret,
      });
      if (!checked.ok) {
        return NextResponse.json({ error: "Signature did not match." }, { status: 401 });
      }
    } else if (!verifyAirwallexSignature(body, signature, settings.webhookSecret)) {
      return NextResponse.json({ error: "Signature did not match." }, { status: 401 });
    }
    const introEvent = parseAirwallexIntroFeeWebhook(body);
    if (introEvent.ok) {
      if (!introEvent.paid) return NextResponse.json({ ok: true, paid: false });
      const settled = await applyIntroFeeFromWebhook({
        intentRef: introEvent.intentRef,
        paymentId: introEvent.paymentId,
        eventId: introEvent.eventId,
      });
      if (!settled.ok) return NextResponse.json({ error: settled.error }, { status: settled.status });
      return NextResponse.json({ ok: true, paid: true, duplicate: settled.duplicate });
    }
    if (introEvent.error !== "not_intro_fee") {
      return NextResponse.json({ error: introEvent.error }, { status: 400 });
    }
    const fundingEvent = parseAirwallexWebhook(body);
    if (!fundingEvent.ok) return NextResponse.json({ error: fundingEvent.error }, { status: 400 });
    const funding = await prisma.collaborationFunding.findUnique({
      where: { id: fundingEvent.fundingId },
      select: {
        id: true,
        currency: true,
        grossCents: true,
        milestones: { select: { id: true, amountCents: true, refundedCents: true } },
      },
    });
    const milestone = fundingEvent.milestoneId
      ? funding?.milestones.find((row) => row.id === fundingEvent.milestoneId)
      : null;
    const payoutEvent = fundingEvent.eventType !== "funding.held";
    const expectedAmount = !funding
      ? -1
      : payoutEvent
        ? milestone
          ? releasableCents(milestone.amountCents, milestone.refundedCents)
          : -1
        : funding.grossCents;
    const advance = providerLedgerAdvance(body, {
      amountCents: expectedAmount,
      currency: funding?.currency || "",
      accountId: settings.holdingAccountId,
      environment: airwallexEnvironment(settings.baseUrl),
      fundingId: funding?.id || "",
    });
    if (!advance.advance) {
      return NextResponse.json({ ok: true, parked: true, reason: advance.reason });
    }
    const result = await applyMarketplaceEvent({
      provider: "airwallex",
      eventId: fundingEvent.eventId,
      eventType: fundingEvent.eventType,
      fundingId: fundingEvent.fundingId,
      amountCents: fundingEvent.amountCents,
      currency: fundingEvent.currency,
      milestoneId: fundingEvent.milestoneId,
    });
    return NextResponse.json(result);
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
