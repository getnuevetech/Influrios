import { prisma } from "@/lib/db";

export const PRODUCT_SWITCHES = [
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
    key: "paid_mentoring",
    enabled: false,
    description:
      "Paid Influencer Mentorship sessions. Off = community mentoring only; never mixes into Collaboration Holding.",
  },
  {
    key: "collab_os_v1",
    enabled: true,
    description:
      "Collaboration OS hubs and contract wizard. Turned off, signed-in users stay on the public landing plus propose/records.",
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
  try {
    const row = await prisma.featureFlag.upsert({
      where: { key },
      update: {},
      create: { key, enabled: spec.enabled, description: spec.description },
    });
    return row.enabled;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code !== "P2002") throw error;
    const row = await prisma.featureFlag.findUnique({ where: { key } });
    return row?.enabled ?? spec.enabled;
  }
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
