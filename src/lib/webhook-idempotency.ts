import { prisma } from "@/lib/db";
import { getProduct, type BillingSku } from "@/lib/billing";
import type { PlanTier } from "@prisma/client";

export type WebhookDisposition = "skip" | "apply" | "ignore";

/** Duplicate event ids never apply again. Unknown event types are stored and ignored. */
export function webhookDisposition(input: {
  duplicate: boolean;
  eventType: string;
}): WebhookDisposition {
  if (input.duplicate) return "skip";
  if (
    input.eventType === "checkout.session.completed" ||
    input.eventType === "customer.subscription.deleted" ||
    input.eventType === "invoice.payment_failed"
  ) {
    return "apply";
  }
  return "ignore";
}

export function subscriptionStatusForEvent(eventType: string): "active" | "canceled" | "past_due" | null {
  if (eventType === "checkout.session.completed") return "active";
  if (eventType === "customer.subscription.deleted") return "canceled";
  if (eventType === "invoice.payment_failed") return "past_due";
  return null;
}

function isUnique(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && String(error.code) === "P2002";
}

/** Local checkout and the Stripe event use different ids. Setting the same plan twice is a no-op write. */
export function checkoutEventId(sessionId: string) {
  return `checkout:${sessionId}`;
}

/** Store an event we do not apply. A second delivery hits the unique key. */
export async function noteWebhook(input: {
  provider: string;
  eventId: string;
  eventType: string;
  result: string;
}): Promise<{ stored: boolean }> {
  try {
    await prisma.processedWebhook.create({ data: input });
    return { stored: true };
  } catch (error) {
    if (isUnique(error)) return { stored: false };
    throw error;
  }
}

/**
 * Insert the provider event id, then set the plan. A second delivery hits the unique
 * key and leaves the user plan untouched.
 */
export async function applyPlanOnce(input: {
  provider: string;
  eventId: string;
  eventType: string;
  sku: string;
  userId?: string | null;
  creatorSlug?: string | null;
  externalId?: string | null;
}): Promise<{ applied: boolean }> {
  const disposition = webhookDisposition({ duplicate: false, eventType: input.eventType });
  const product = getProduct(input.sku);
  const status = subscriptionStatusForEvent(input.eventType);
  if (!product || !status || disposition !== "apply") return { applied: false };

  const plan = (product.creatorPlan || product.businessPlan) as PlanTier | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.processedWebhook.create({
        data: {
          provider: input.provider,
          eventId: input.eventId,
          eventType: input.eventType,
          result: status,
        },
      });
      if (status === "active" && plan && input.userId) {
        await tx.user.update({ where: { id: input.userId }, data: { planTier: plan } });
      }
      if (status === "active" && product.creatorPlan && input.creatorSlug) {
        await tx.creator.updateMany({
          where: { slug: input.creatorSlug },
          data: { planTier: product.creatorPlan },
        });
      }
      await tx.subscriptionState.upsert({
        where: {
          provider_externalId: {
            provider: input.provider,
            externalId: input.externalId || input.eventId,
          },
        },
        create: {
          provider: input.provider,
          externalId: input.externalId || input.eventId,
          sku: input.sku as BillingSku,
          status,
          userId: input.userId || null,
          creatorSlug: input.creatorSlug || null,
        },
        update: {
          sku: input.sku,
          status,
          userId: input.userId || undefined,
          creatorSlug: input.creatorSlug || undefined,
        },
      });
    });
    return { applied: true };
  } catch (error) {
    if (isUnique(error)) return { applied: false };
    throw error;
  }
}
