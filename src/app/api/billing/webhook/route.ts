import { NextRequest, NextResponse } from "next/server";
import {
  completeCheckout,
  getProduct,
  isStripeConfigured,
  markWebhookReceived,
  type BillingSku,
} from "@/lib/billing";

/**
 * Stripe webhook receiver. In demo mode without Stripe, returns 501 guidance.
 * Handles checkout.session.completed → completeCheckout(localSessionId).
 */
export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Stripe not configured. Set STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET for live webhooks. Demo checkout completes via /billing/success.",
      },
      { status: 501 },
    );
  }

  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-02-24.acacia",
  });

  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      metadata?: { localSessionId?: string; creatorSlug?: string; sku?: string };
    };
    const localId = session.metadata?.localSessionId;
    if (localId) {
      await completeCheckout(localId, {
        creatorSlug: session.metadata?.creatorSlug || undefined,
      });
    } else if (session.metadata?.sku) {
      // Fallback: no local id — still acknowledge
      getProduct(session.metadata.sku as BillingSku);
    }
  }

  return NextResponse.json({ received: true });
}
