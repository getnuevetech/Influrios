/**
 * Phase 6 — Monetization / billing (Stripe-ready, demo fallback).
 * Catalog covers Creator Plus/Pro and Business Pro/Agency.
 * Without STRIPE_SECRET_KEY, checkout completes in demo mode and upgrades local stores.
 */
import { promises as fs } from "fs";
import path from "path";
import { setBusinessPlan } from "@/lib/business";
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
      "JSON/CSV exports",
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
      "Managed matching entitlement",
      "15 team seats",
    ],
    businessPlan: "AGENCY",
    stripePriceEnv: "STRIPE_PRICE_AGENCY",
  },
];

export function getProduct(sku: string): BillingProduct | undefined {
  return BILLING_CATALOG.find((p) => p.sku === sku);
}

export type CheckoutSessionRecord = {
  id: string;
  sku: BillingSku;
  mode: "stripe" | "demo";
  status: "open" | "completed" | "canceled";
  customerEmail?: string;
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
const STORE_PATH = path.join(DATA_DIR, "billing.json");

const DEFAULT_STORE: BillingStore = {
  sessions: [],
  creatorOverrides: [
    {
      creatorSlug: "sofia-martinez",
      plan: "PLUS",
      updatedAt: new Date().toISOString(),
      source: "demo",
    },
  ],
};

async function ensureStore(): Promise<BillingStore> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return { ...DEFAULT_STORE, ...(JSON.parse(raw) as BillingStore) };
  } catch {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(STORE_PATH, JSON.stringify(DEFAULT_STORE, null, 2), "utf8");
    } catch {
      /* read-only */
    }
    return structuredClone(DEFAULT_STORE);
  }
}

async function saveStore(store: BillingStore) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  } catch {
    /* ignore */
  }
}

export async function getBillingStore(): Promise<BillingStore> {
  return ensureStore();
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
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
}): Promise<StartCheckoutResult> {
  const product = getProduct(input.sku);
  if (!product) return { ok: false, error: "Unknown plan SKU" };

  const store = await ensureStore();
  const sessionId = newId("cs");

  if (isStripeConfigured()) {
    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: "2025-02-24.acacia",
      });
      const priceId = process.env[product.stripePriceEnv];
      const origin = getAppOrigin();
      const lineItems = priceId
        ? [{ price: priceId, quantity: 1 }]
        : [
            {
              price_data: {
                currency: "usd",
                unit_amount: product.amountCents,
                recurring: { interval: "month" as const },
                product_data: {
                  name: product.name,
                  description: product.description,
                },
              },
              quantity: 1,
            },
          ];

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: lineItems,
        success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}&local=${sessionId}`,
        cancel_url: `${origin}/billing/cancel?local=${sessionId}`,
        customer_email: input.customerEmail || undefined,
        metadata: {
          sku: product.sku,
          localSessionId: sessionId,
          creatorSlug: input.creatorSlug ?? "",
        },
      });

      store.sessions.unshift({
        id: sessionId,
        sku: product.sku,
        mode: "stripe",
        status: "open",
        customerEmail: input.customerEmail,
        stripeSessionId: session.id,
        createdAt: new Date().toISOString(),
      });
      await saveStore(store);

      if (!session.url) return { ok: false, error: "Stripe session missing URL" };
      return { ok: true, mode: "stripe", url: session.url, sessionId };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Stripe checkout failed";
      return { ok: false, error: message };
    }
  }

  // Demo checkout — no Stripe keys required
  store.sessions.unshift({
    id: sessionId,
    sku: product.sku,
    mode: "demo",
    status: "open",
    customerEmail: input.customerEmail,
    createdAt: new Date().toISOString(),
  });
  await saveStore(store);

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
  const store = await ensureStore();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) return { ok: false, error: "Checkout session not found" };
  if (session.status === "completed") {
    const product = getProduct(session.sku)!;
    return { ok: true, product };
  }

  const product = getProduct(session.sku);
  if (!product) return { ok: false, error: "Unknown product on session" };

  session.status = "completed";
  session.completedAt = new Date().toISOString();

  if (product.businessPlan) {
    await setBusinessPlan(product.businessPlan);
  }

  if (product.creatorPlan) {
    const slug = opts?.creatorSlug || "sofia-martinez";
    const existing = store.creatorOverrides.find((c) => c.creatorSlug === slug);
    if (existing) {
      existing.plan = product.creatorPlan;
      existing.updatedAt = new Date().toISOString();
      existing.source = "checkout";
    } else {
      store.creatorOverrides.push({
        creatorSlug: slug,
        plan: product.creatorPlan,
        updatedAt: new Date().toISOString(),
        source: "checkout",
      });
    }
  }

  await saveStore(store);
  return { ok: true, product };
}

export async function cancelCheckout(sessionId: string) {
  const store = await ensureStore();
  const session = store.sessions.find((s) => s.id === sessionId);
  if (session && session.status === "open") {
    session.status = "canceled";
    await saveStore(store);
  }
}

export async function getCreatorPlanOverride(slug: string): Promise<PlanCode | null> {
  const store = await ensureStore();
  return store.creatorOverrides.find((c) => c.creatorSlug === slug)?.plan ?? null;
}

export async function markWebhookReceived() {
  const store = await ensureStore();
  store.lastWebhookAt = new Date().toISOString();
  await saveStore(store);
}
