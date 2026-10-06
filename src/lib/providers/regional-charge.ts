import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { applyMarketplaceEvent } from "@/lib/marketplace-ledger";
import { decryptSecret } from "@/lib/provider-secrets";
import { parseFlutterwaveWebhook, verifyFlutterwaveSignature } from "@/lib/providers/flutterwave";
import { parseMpesaWebhook, verifyMpesaSignature } from "@/lib/providers/mpesa";
import type { RegionalCharge } from "@/lib/providers/flutterwave";
import { confirmMentorshipPayment } from "@/lib/mentorship";
import { applyPlanOnce } from "@/lib/webhook-idempotency";

export async function gatewayWebhookSecret(code: "flutterwave" | "mpesa") {
  const row = await prisma.integrationProvider.findUnique({
    where: { kind_code: { kind: "payment", code } },
  });
  if (!row?.enabled || !row.secretCipher || !row.webhookCipher) return { error: "not_ready" as const };
  const secret = decryptSecret(row.webhookCipher);
  const apiSecret = decryptSecret(row.secretCipher);
  if (!secret || !apiSecret) return { error: "not_ready" as const };
  return { code, secret, apiSecret, baseUrl: row.baseUrl ?? "" };
}

export function readRegionalWebhook(
  provider: "flutterwave" | "mpesa",
  body: string,
  signature: string | null,
  secret: string,
): { ok: true; charge: RegionalCharge } | { ok: false; error: string; status: number } {
  const verified =
    provider === "flutterwave"
      ? verifyFlutterwaveSignature(signature, secret)
      : verifyMpesaSignature(body, signature, secret);
  if (!verified) return { ok: false, error: "Signature did not match.", status: 401 };
  const parsed = provider === "flutterwave" ? parseFlutterwaveWebhook(body) : parseMpesaWebhook(body);
  if (!parsed.ok) return { ok: false, error: parsed.error, status: 400 };
  return parsed;
}

/** A verified charge can pay a plan checkout or hold a funding. It never invents a paid state. */
export async function applyRegionalCharge(charge: RegionalCharge) {
  const seen = await prisma.processedWebhook.findUnique({
    where: { provider_eventId: { provider: charge.provider, eventId: charge.eventId } },
  });
  if (seen) return { ok: true as const, duplicate: true };
  if (!charge.paid) {
    await prisma.processedWebhook.create({
      data: {
        provider: charge.provider,
        eventId: charge.eventId,
        eventType: "charge.unpaid",
        result: "ignored",
      },
    });
    return { ok: true as const, paid: false };
  }

  const mentorship = await prisma.mentorshipRequest.findFirst({ where: { checkoutRef: charge.txRef } });
  if (mentorship) {
    const confirmed = await confirmMentorshipPayment({
      requestId: mentorship.id,
      checkoutRef: charge.txRef,
      provider: charge.provider,
    });
    if (!confirmed.ok) return confirmed;
  } else {
    const attempt = await prisma.checkoutAttempt.findFirst({
      where: { OR: [{ id: charge.txRef }, { stripeSessionId: charge.txRef }] },
    });
    if (attempt) {
      const plan = await applyPlanOnce({
        provider: charge.provider,
        eventId: charge.eventId,
        eventType: "checkout.session.completed",
        sku: attempt.sku,
        userId: attempt.userId,
        creatorSlug: attempt.creatorSlug,
        externalId: charge.txRef,
      });
      if (!plan.applied) return { ok: false as const, error: "Checkout was not applied." };
      await prisma.checkoutAttempt.update({
        where: { id: attempt.id },
        data: { status: "completed", completedAt: new Date() },
      });
      await markGatewayWebhook(charge.provider);
      return { ok: true as const, paid: true };
    }
    const funding = await prisma.collaborationFunding.findUnique({ where: { id: charge.txRef } });
    if (!funding) return { ok: false as const, error: "Unknown charge reference." };
    const held = await applyMarketplaceEvent({
      provider: charge.provider,
      eventId: charge.eventId,
      eventType: "funding.held",
      fundingId: funding.id,
      amountCents: charge.amountCents || funding.grossCents,
    });
    if (!held.applied && held.result !== "duplicate") {
      return { ok: false as const, error: "Funding was not held." };
    }
  }

  await prisma.processedWebhook.create({
    data: {
      provider: charge.provider,
      eventId: charge.eventId,
      eventType: "charge.paid",
      result: "applied",
    },
  });
  await markGatewayWebhook(charge.provider);
  return { ok: true as const, paid: true };
}

export async function markGatewayWebhook(code: string) {
  const row = await prisma.integrationProvider.findUnique({
    where: { kind_code: { kind: "payment", code } },
  });
  if (!row) return;
  const extra =
    row.extraJson && typeof row.extraJson === "object" && !Array.isArray(row.extraJson)
      ? { ...(row.extraJson as Record<string, unknown>) }
      : {};
  extra.lastWebhookAt = new Date().toISOString();
  await prisma.integrationProvider.update({
    where: { id: row.id },
    data: { extraJson: extra as Prisma.InputJsonValue },
  });
}
