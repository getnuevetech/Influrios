/**
 * Phase 6 / Phase L.4 — Monetization / billing (Stripe-ready, demo fallback).
 * Catalog covers Creator Plus/Pro and Business Pro/Agency.
 * Checkout attempts live in Postgres (CheckoutAttempt). Plan truth is User /
 * Creator / SubscriptionState. One-time import from data/billing.json.
 */
import { promises as fs } from "fs";
import path from "path";
import { setBusinessPlan } from "@/lib/business";
import { prisma } from "@/lib/db";
import { productSwitch } from "@/lib/product-switches";
import { confirmStripeCheckout, openStripeCheckout, stripeCredentials } from "@/lib/stripe-admin";
import type { BusinessPlanCode } from "@/lib/business-entitlements";
import type { PlanCode } from "@/lib/entitlements";

export type BillingAudience = "creator" | "business";

export type BillingSku =
  | "creator_plus"
  | "creator_pro"
  | "business_pro"
  | "agency";

export type BillingProduct = {
  sku: BillingSku;
  audience: BillingAudience;
  name: string;
  priceLabel: string;
  /** Monthly amount in cents for Stripe Price (demo / future Price IDs) */
  amountCents: number;
  interval: "month";
  description: string;
  highlights: string[];
  creatorPlan?: PlanCode;
  businessPlan?: BusinessPlanCode;
  /** Optional live Stripe Price ID from env / dashboard */
  stripePriceEnv: string;
};

export const BILLING_CATALOG: BillingProduct[] = [
  {
    sku: "creator_plus",
    audience: "creator",
    name: "Creator Plus",
    priceLabel: "$19/mo",
    amountCents: 1900,
    interval: "month",
    description: "Shortlink, standard QR, and collaboration requests.",
    highlights: [
      "Shortlink + standard QR",
      "Up to 3 specialties · 4 socials",
      "Request collab matches",
    ],
    creatorPlan: "PLUS",
    stripePriceEnv: "STRIPE_PRICE_CREATOR_PLUS",
  },
  {
    sku: "creator_pro",
    audience: "creator",
    name: "Creator Pro",
    priceLabel: "$29/mo",
    amountCents: 2900,
    interval: "month",
    description: "Dynamic QR, lead routing, media kit, advanced analytics.",
    highlights: [
      "Dynamic QR + lead routing",
      "Priority collab tools",
      "Media kit + advanced analytics",
    ],
    creatorPlan: "PRO",
    stripePriceEnv: "STRIPE_PRICE_CREATOR_PRO",
  },
  {
    sku: "business_pro",
    audience: "business",
    name: "Business Pro",
    priceLabel: "$99/mo",
    amountCents: 9900,
    interval: "month",
    description: "Shortlists, fit insights, Intelligence, and exports.",
    highlights: [
      "100 shortlist · 50 inquiries/mo",
      "Fit insights + Intelligence",
      "Custom milestone schedules",
    ],
    businessPlan: "BUSINESS_PRO",
    stripePriceEnv: "STRIPE_PRICE_BUSINESS_PRO",
  },
  {
    sku: "agency",
    audience: "business",
    name: "Agency",
    priceLabel: "$349/mo",
    amountCents: 34900,
    interval: "month",
    description: "Team seats, managed matching, and higher limits.",
    highlights: [
      "500 shortlist · 200 inquiries/mo",
      "Managed matching + custom milestones",
      "15 team seats",
    ],
    businessPlan: "AGENCY",
    stripePriceEnv: "STRIPE_PRICE_AGENCY",
  },
];

export function getProduct(sku: string): BillingProduct | undefined {
  return BILLING_CATALOG.find((p) => p.sku === sku);
}

export function isBillingSku(value: string): value is BillingSku {
  return BILLING_CATALOG.some((product) => product.sku === value);
}

export type CheckoutSessionRecord = {
  id: string;
  sku: BillingSku;
  mode: "stripe" | "demo";
  status: "open" | "completed" | "canceled";
  customerEmail?: string;
  userId?: string;
  creatorSlug?: string;
  stripeSessionId?: string;
  createdAt: string;
  completedAt?: string;
};

export type CreatorPlanOverride = {
  creatorSlug: string;
  plan: PlanCode;
  updatedAt: string;
  source: "checkout" | "admin" | "demo";
};

export type BillingStore = {
  sessions: CheckoutSessionRecord[];
  creatorOverrides: CreatorPlanOverride[];
  lastWebhookAt?: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const LEGACY_STORE_PATH = path.join(DATA_DIR, "billing.json");
const LEGACY_MIGRATED_PATH = path.join(DATA_DIR, "billing.json.migrated");
const LAST_WEBHOOK_KEY = "billing.lastWebhookAt";

function asSku(value: string): BillingSku | null {
  return isBillingSku(value) ? value : null;
}

function sessionFromRow(row: {
  id: string;
  sku: string;
  mode: string;
  status: string;
  customerEmail: string | null;
  userId: string | null;
  creatorSlug: string | null;
  stripeSessionId: string | null;
  createdAt: Date;
  completedAt: Date | null;
}): CheckoutSessionRecord | null {
  const sku = asSku(row.sku);
  if (!sku) return null;
  const mode = row.mode === "stripe" ? "stripe" : "demo";
  const status =
    row.status === "completed" || row.status === "canceled" || row.status === "open"
      ? row.status
      : "open";
  return {
    id: row.id,
    sku,
    mode,
    status,
    customerEmail: row.customerEmail ?? undefined,
    userId: row.userId ?? undefined,
    creatorSlug: row.creatorSlug ?? undefined,
    stripeSessionId: row.stripeSessionId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString(),
  };
}

async function upsertAttempt(session: CheckoutSessionRecord) {
  await prisma.checkoutAttempt.upsert({
    where: { id: session.id },
    create: {
      id: session.id,
      sku: session.sku,
      mode: session.mode,
      status: session.status,
      customerEmail: session.customerEmail,
      userId: session.userId,
      creatorSlug: session.creatorSlug,
      stripeSessionId: session.stripeSessionId,
      createdAt: new Date(session.createdAt),
      completedAt: session.completedAt ? new Date(session.completedAt) : null,
    },
    update: {
      sku: session.sku,
      mode: session.mode,
      status: session.status,
      customerEmail: session.customerEmail,
      userId: session.userId,
      creatorSlug: session.creatorSlug,
      stripeSessionId: session.stripeSessionId,
      completedAt: session.completedAt ? new Date(session.completedAt) : null,
    },
  });
}

async function readLegacyBilling(): Promise<{
  sessions: CheckoutSessionRecord[];
  lastWebhookAt?: string;
} | null> {
  try {
    const raw = await fs.readFile(LEGACY_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<BillingStore>;
    const sessions = (parsed.sessions ?? [])
      .map((session) => {
        const sku = asSku(session.sku);
        if (!sku) return null;
        return {
          ...session,
          sku,
          mode: session.mode === "stripe" ? ("stripe" as const) : ("demo" as const),
          status:
            session.status === "completed" || session.status === "canceled"
              ? session.status
              : ("open" as const),
        };
      })
      .filter((session): session is CheckoutSessionRecord => Boolean(session));
    return {
      sessions,
      lastWebhookAt: typeof parsed.lastWebhookAt === "string" ? parsed.lastWebhookAt : undefined,
    };
  } catch {
    return null;
  }
}

async function markLegacyMigrated() {
  try {
    await fs.rename(LEGACY_STORE_PATH, LEGACY_MIGRATED_PATH);
  } catch {
    try {
      await fs.unlink(LEGACY_STORE_PATH);
    } catch {
      /* ignore */
    }
  }
}

async function migrateLegacyBillingOnce() {
  const count = await prisma.checkoutAttempt.count();
  if (count > 0) return;
  const legacy = await readLegacyBilling();
  if (!legacy) return;
  for (const session of legacy.sessions) {
    await upsertAttempt(session);
  }
  if (legacy.lastWebhookAt) {
    await prisma.platformSetting.upsert({
      where: { key: LAST_WEBHOOK_KEY },
      create: { key: LAST_WEBHOOK_KEY, value: legacy.lastWebhookAt },
      update: { value: legacy.lastWebhookAt },
    });
  }
  await markLegacyMigrated();
}

async function loadCreatorOverrides(): Promise<CreatorPlanOverride[]> {
  const creators = await prisma.creator.findMany({
    where: { planTier: { in: ["PLUS", "PRO"] } },
    select: { slug: true, planTier: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return creators
    .filter((row): row is typeof row & { planTier: "PLUS" | "PRO" } => row.planTier === "PLUS" || row.planTier === "PRO")
    .map((row) => ({
      creatorSlug: row.slug,
      plan: row.planTier,
      updatedAt: row.updatedAt.toISOString(),
      source: "checkout" as const,
    }));
}

async function loadLastWebhookAt(): Promise<string | undefined> {
  const row = await prisma.platformSetting.findUnique({ where: { key: LAST_WEBHOOK_KEY } });
  if (typeof row?.value === "string") return row.value;
  const job = await prisma.job.findFirst({
    where: { kind: "provider_webhook" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return job?.createdAt.toISOString();
}

export async function getBillingStore(): Promise<BillingStore> {
  await migrateLegacyBillingOnce();
  const [rows, creatorOverrides, lastWebhookAt] = await Promise.all([
    prisma.checkoutAttempt.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    loadCreatorOverrides(),
    loadLastWebhookAt(),
  ]);
  return {
    sessions: rows.map(sessionFromRow).filter((session): session is CheckoutSessionRecord => Boolean(session)),
    creatorOverrides,
    lastWebhookAt,
  };
}

export async function getCheckoutAttempt(sessionId: string): Promise<CheckoutSessionRecord | null> {
  await migrateLegacyBillingOnce();
  const row = await prisma.checkoutAttempt.findUnique({ where: { id: sessionId } });
  return row ? sessionFromRow(row) : null;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

const PRICE_ID = /^price_[A-Za-z0-9]+$/;

export async function billingPriceId(sku: BillingSku, envName: string) {
  const row = await prisma.platformSetting.findUnique({ where: { key: "billing.prices" } }).catch(() => null);
  const stored =
    row?.value && typeof row.value === "object" && !Array.isArray(row.value)
      ? (row.value as Record<string, unknown>)[sku]
      : "";
  if (typeof stored === "string" && PRICE_ID.test(stored)) return stored;
  const fromEnv = process.env[envName] ?? "";
  return PRICE_ID.test(fromEnv) ? fromEnv : "";
}

export async function listBillingPriceIds(): Promise<Record<BillingSku, string>> {
  const row = await prisma.platformSetting.findUnique({ where: { key: "billing.prices" } }).catch(() => null);
  const value = row?.value && typeof row.value === "object" && !Array.isArray(row.value) ? (row.value as Record<string, unknown>) : {};
  const prices = {} as Record<BillingSku, string>;
  for (const product of BILLING_CATALOG) {
    const stored = value[product.sku];
    prices[product.sku] = typeof stored === "string" ? stored : "";
  }
  return prices;
}

export async function saveBillingPriceIds(prices: Partial<Record<BillingSku, string>>) {
  const next: Record<string, string> = {};
  for (const product of BILLING_CATALOG) {
    const trimmed = (prices[product.sku] ?? "").trim();
    if (trimmed && !PRICE_ID.test(trimmed)) throw new Error("A Stripe price id starts with price_.");
    if (trimmed) next[product.sku] = trimmed;
  }
  await prisma.platformSetting.upsert({
    where: { key: "billing.prices" },
    update: { value: next },
    create: { key: "billing.prices", value: next },
  });
}

export function getAppOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000"
  );
}

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export type StartCheckoutResult =
  | { ok: true; mode: "stripe" | "demo"; url: string; sessionId: string }
  | { ok: false; error: string };

/** Start Checkout — Stripe when configured, otherwise demo success URL. */
export async function startCheckout(input: {
  sku: BillingSku;
  customerEmail?: string;
  creatorSlug?: string;
  userId?: string;
}): Promise<StartCheckoutResult> {
  const product = getProduct(input.sku);
  if (!product) return { ok: false, error: "Unknown plan SKU" };

  const creds = await stripeCredentials();
  if (!creds.ok && creds.reason === "rejected") {
    return { ok: false, error: "Use a Stripe sandbox key. Nothing was charged." };
  }
  if (!creds.ok) {
    const demo = await productSwitch("demo_checkout");
    if (!demo) return { ok: false, error: "Checkout is turned off. Nothing was charged." };
  }

  await migrateLegacyBillingOnce();
  const sessionId = newId("cs");
  const createdAt = new Date().toISOString();

  if (creds.ok) {
    const priceId = await billingPriceId(product.sku, product.stripePriceEnv);
    const origin = getAppOrigin();
    const opened = await openStripeCheckout({
      secret: creds.secret,
      mode: creds.mode,
      priceId,
      amountCents: product.amountCents,
      name: product.name,
      description: product.description,
      successUrl: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}&local=${sessionId}`,
      cancelUrl: `${origin}/billing/cancel?local=${sessionId}`,
      customerEmail: input.customerEmail,
      metadata: {
        sku: product.sku,
        localSessionId: sessionId,
        creatorSlug: input.creatorSlug ?? "",
        userId: input.userId ?? "",
      },
    });
    if (!opened.ok) return opened;
    await upsertAttempt({
      id: sessionId,
      sku: product.sku,
      mode: "stripe",
      status: "open",
      customerEmail: input.customerEmail,
      userId: input.userId,
      creatorSlug: input.creatorSlug,
      stripeSessionId: opened.id,
      createdAt,
    });
    return { ok: true, mode: "stripe", url: opened.url, sessionId };
  }

  await upsertAttempt({
    id: sessionId,
    sku: product.sku,
    mode: "demo",
    status: "open",
    customerEmail: input.customerEmail,
    userId: input.userId,
    creatorSlug: input.creatorSlug,
    createdAt,
  });

  const origin = getAppOrigin();
  const params = new URLSearchParams({
    local: sessionId,
    demo: "1",
    sku: product.sku,
  });
  if (input.creatorSlug) params.set("creator", input.creatorSlug);
  return {
    ok: true,
    mode: "demo",
    url: `${origin}/billing/success?${params.toString()}`,
    sessionId,
  };
}

export async function completeCheckout(sessionId: string, opts?: {
  creatorSlug?: string;
}): Promise<{ ok: true; product: BillingProduct } | { ok: false; error: string }> {
  const session = await getCheckoutAttempt(sessionId);
  if (!session) return { ok: false, error: "Checkout session not found" };
  if (session.status === "completed") {
    const product = getProduct(session.sku)!;
    return { ok: true, product };
  }

  const product = getProduct(session.sku);
  if (!product) return { ok: false, error: "Unknown product on session" };

  if (session.mode === "stripe") {
    const creds = await stripeCredentials();
    if (!creds.ok || !session.stripeSessionId) {
      return { ok: false, error: "Stripe has not confirmed this payment. Nothing was changed." };
    }
    const confirmed = await confirmStripeCheckout({
      secret: creds.secret,
      mode: creds.mode,
      checkoutSessionId: session.stripeSessionId,
      localId: session.id,
    });
    if (!confirmed.ok) return confirmed;
  }

  const slug = opts?.creatorSlug || session.creatorSlug || (product.creatorPlan ? "sofia-martinez" : undefined);
  try {
    const { applyPlanOnce, checkoutEventId } = await import("@/lib/webhook-idempotency");
    await applyPlanOnce({
      provider: session.mode === "stripe" ? "stripe" : "demo",
      eventId: checkoutEventId(session.id),
      eventType: "checkout.session.completed",
      sku: session.sku,
      userId: session.userId,
      creatorSlug: slug,
      externalId: session.stripeSessionId || session.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not record the subscription.";
    return { ok: false, error: message };
  }

  session.status = "completed";
  session.completedAt = new Date().toISOString();
  await upsertAttempt(session);

  if (product.businessPlan) {
    await setBusinessPlan(product.businessPlan);
  }

  return { ok: true, product };
}

/**
 * Ensure a CheckoutAttempt exists for a Stripe webhook when the open row was lost.
 * Uses Stripe metadata only — never invents a paid status without applyPlanOnce.
 */
export async function ensureStripeAttemptFromMetadata(input: {
  localId: string;
  sku: string;
  userId?: string;
  creatorSlug?: string;
  stripeSessionId?: string;
}): Promise<CheckoutSessionRecord | null> {
  const sku = asSku(input.sku);
  if (!sku) return null;
  const existing = await getCheckoutAttempt(input.localId);
  if (existing) return existing;
  const session: CheckoutSessionRecord = {
    id: input.localId,
    sku,
    mode: "stripe",
    status: "open",
    userId: input.userId || undefined,
    creatorSlug: input.creatorSlug || undefined,
    stripeSessionId: input.stripeSessionId,
    createdAt: new Date().toISOString(),
  };
  await upsertAttempt(session);
  return session;
}

export async function cancelCheckout(sessionId: string) {
  const session = await getCheckoutAttempt(sessionId);
  if (session && session.status === "open") {
    session.status = "canceled";
    await upsertAttempt(session);
  }
}

export async function getCreatorPlanOverride(slug: string): Promise<PlanCode | null> {
  const creator = await prisma.creator.findUnique({
    where: { slug },
    select: { planTier: true },
  });
  if (creator?.planTier === "PLUS" || creator?.planTier === "PRO") return creator.planTier;
  return null;
}

export async function markWebhookReceived() {
  const at = new Date().toISOString();
  await prisma.platformSetting.upsert({
    where: { key: LAST_WEBHOOK_KEY },
    create: { key: LAST_WEBHOOK_KEY, value: at },
    update: { value: at },
  });
}
