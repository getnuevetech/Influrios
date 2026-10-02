import { prisma } from "@/lib/db";

export const PRODUCT_SWITCHES = [
  {
    key: "demo_checkout",
    enabled: true,
    description: "Checkout can finish without Stripe. Turn this off and nothing is charged until Stripe is ready.",
  },
  {
    key: "customer_portal",
    enabled: false,
    description: "Members can open the Stripe billing portal. Turned off, the portal stays closed.",
  },
  {
    key: "stripe_connect",
    enabled: false,
    description: "Stripe Connect account links. Turned off, no payout account is opened.",
  },
  {
    key: "financial_reports",
    enabled: true,
    description: "Marketplace ledger report by month. Turn this off to hide the report.",
  },
  {
    key: "agency_seats",
    enabled: false,
    description: "Named seats on the agency workspace. Turned off, the roster stays and new seats are refused.",
  },
  {
    key: "legacy_demo_payments",
    enabled: false,
    description:
      "Phase 9/10 JSON escrow and trust demo consoles. Turned off, product CTAs stay on the marketplace ledger.",
  },
] as const;

export type ProductSwitchKey = (typeof PRODUCT_SWITCHES)[number]["key"];

const testOverrides = new Map<string, boolean>();

/** Tests pin a switch without writing the shared flag row. */
export function setProductSwitchForTests(key: ProductSwitchKey, enabled: boolean | null) {
  if (enabled == null) testOverrides.delete(key);
  else testOverrides.set(key, enabled);
}

export function isProductSwitchKey(value: string): value is ProductSwitchKey {
  return PRODUCT_SWITCHES.some((row) => row.key === value);
}

export async function productSwitch(key: ProductSwitchKey): Promise<boolean> {
  if (testOverrides.has(key)) return testOverrides.get(key)!;
  const spec = PRODUCT_SWITCHES.find((row) => row.key === key)!;
  const row = await prisma.featureFlag.upsert({
    where: { key },
    update: {},
    create: { key, enabled: spec.enabled, description: spec.description },
  });
  return row.enabled;
}

export async function listProductSwitches() {
  return Promise.all(
    PRODUCT_SWITCHES.map(async (spec) => ({
      ...spec,
      enabled: await productSwitch(spec.key),
    })),
  );
}

export async function setProductSwitch(key: ProductSwitchKey, enabled: boolean) {
  const spec = PRODUCT_SWITCHES.find((row) => row.key === key);
  if (!spec) throw new Error("Unknown switch.");
  await prisma.featureFlag.upsert({
    where: { key },
    update: { enabled, description: spec.description },
    create: { key, enabled, description: spec.description },
  });
}
