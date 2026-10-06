import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  completeCheckout,
  ensureStripeAttemptFromMetadata,
  markWebhookReceived,
} from "@/lib/billing";
import { confirmMentorshipPayment } from "@/lib/mentorship";
import { rememberStripeCustomer, stripeCredentials, stripeWebhookSecret } from "@/lib/stripe-admin";
import { applyPlanOnce, noteWebhook, webhookDisposition } from "@/lib/webhook-idempotency";

type StripeObject = {
  id?: string;
  customer?: string | { id?: string } | null;
  metadata?: {
    localSessionId?: string;
    creatorSlug?: string;
    sku?: string;
    userId?: string;
    purpose?: string;
    requestId?: string;
  } | null;
  subscription?: string | { id?: string } | null;
};

function customerIdOf(object: StripeObject) {
  const raw = typeof object.customer === "string" ? object.customer : object.customer?.id;
  return raw ?? null;
}

function subscriptionId(object: StripeObject, eventType: string) {
  if (eventType === "customer.subscription.deleted" && object.id) return object.id;
  if (typeof object.subscription === "string") return object.subscription;
  if (object.subscription && typeof object.subscription === "object" && object.subscription.id) {
    return object.subscription.id;
  }
  return object.id;
}

/**
 * Stripe webhook. A duplicate event id does not change the plan again.
 * checkout.session.completed can apply from metadata when the local attempt is missing.
 */
export async function POST(req: NextRequest) {
  const creds = await stripeCredentials();
  if (!creds.ok) {
    return NextResponse.json(
      {
        ok: false,
        message:
          creds.reason === "rejected"
            ? "Use a Stripe sandbox key. Nothing was charged."
            : "Stripe is not ready. Nothing was charged.",
      },
      { status: 501 },
    );
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(creds.secret, {
    apiVersion: "2025-02-24.acacia",
  });

  const sig = req.headers.get("stripe-signature");
  const secret = await stripeWebhookSecret();
  if (!sig || !secret) {
    return NextResponse.json({ error: "Missing webhook signature or secret" }, { status: 400 });
  }

  const body = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await markWebhookReceived();
  const object = event.data.object as StripeObject;
  const existing = await prisma.processedWebhook.findUnique({
    where: { provider_eventId: { provider: "stripe", eventId: event.id } },
  });
  const disposition = webhookDisposition({ duplicate: Boolean(existing), eventType: event.type });

  if (disposition === "skip") {
    const localId = object.metadata?.localSessionId;
    if (event.type === "checkout.session.completed" && localId) {
      await completeCheckout(localId, { creatorSlug: object.metadata?.creatorSlug || undefined });
    }
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (disposition === "ignore") {
    await noteWebhook({ provider: "stripe", eventId: event.id, eventType: event.type, result: "ignored" });
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    if (event.type === "checkout.session.completed" && object.metadata?.purpose === "mentorship") {
      const requestId = object.metadata.requestId?.trim() ?? "";
      if (!requestId || !object.id) {
        return NextResponse.json({ received: false, pending: true }, { status: 503 });
      }
      const confirmed = await confirmMentorshipPayment({
        requestId,
        checkoutRef: object.id,
        provider: "stripe",
      });
      if (!confirmed.ok) {
        return NextResponse.json({ error: confirmed.error }, { status: 409 });
      }
      await rememberStripeCustomer(object.metadata.userId, customerIdOf(object));
      await noteWebhook({ provider: "stripe", eventId: event.id, eventType: event.type, result: "mentorship_paid" });
      return NextResponse.json({ received: true, mentorship: true });
    }

    if (event.type === "checkout.session.completed") {
      const localId = object.metadata?.localSessionId;
      const metaSku = object.metadata?.sku;
      if (!localId || !metaSku) {
        return NextResponse.json({ received: false, pending: true }, { status: 503 });
      }
      const local = await ensureStripeAttemptFromMetadata({
        localId,
        sku: metaSku,
        userId: object.metadata?.userId || undefined,
        creatorSlug: object.metadata?.creatorSlug || undefined,
        stripeSessionId: object.id,
      });
      if (!local) {
        return NextResponse.json({ received: false, pending: true }, { status: 503 });
      }
      await applyPlanOnce({
        provider: "stripe",
        eventId: event.id,
        eventType: event.type,
        sku: local.sku,
        userId: local.userId || object.metadata?.userId,
        creatorSlug: object.metadata?.creatorSlug || local.creatorSlug,
        externalId: subscriptionId(object, event.type) || local.stripeSessionId || local.id,
      });
      await rememberStripeCustomer(local.userId || object.metadata?.userId, customerIdOf(object));
      await completeCheckout(local.id, { creatorSlug: object.metadata?.creatorSlug || local.creatorSlug });
    } else {
      const externalId = subscriptionId(object, event.type);
      const state = externalId
        ? await prisma.subscriptionState.findUnique({
            where: { provider_externalId: { provider: "stripe", externalId } },
          })
        : null;
      const sku = object.metadata?.sku || state?.sku;
      if (!sku || !externalId) {
        return NextResponse.json({ received: false, pending: true }, { status: 503 });
      }
      await applyPlanOnce({
        provider: "stripe",
        eventId: event.id,
        eventType: event.type,
        sku,
        userId: object.metadata?.userId || state?.userId,
        creatorSlug: object.metadata?.creatorSlug || state?.creatorSlug,
        externalId,
      });
    }
    await prisma.job
      .create({
        data: {
          kind: "provider_webhook",
          status: "succeeded",
          payload: { eventId: event.id, eventType: event.type },
        },
      })
      .catch(() => undefined);
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook apply failed";
    await prisma.job
      .create({
        data: {
          kind: "provider_webhook",
          status: "failed",
          lastError: message.slice(0, 500),
          attempts: 1,
          payload: { eventId: event.id, eventType: event.type },
        },
      })
      .catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
