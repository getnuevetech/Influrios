import type { AdminModule } from "@/lib/admin-auth";

export const PAYMENT_SETTINGS_TABS = [
  { id: "providers", label: "Providers", modules: ["gateways"] },
  { id: "routes", label: "Country routes", modules: ["gateways", "collab_finance", "marketplace"] },
  { id: "fees", label: "Fees & policies", modules: ["commerce", "marketplace", "collab_finance"] },
] as const;

export type PaymentSettingsSection = (typeof PAYMENT_SETTINGS_TABS)[number]["id"];

const SECTION_ALIASES: Record<string, PaymentSettingsSection> = {
  providers: "providers",
  gateways: "providers",
  routes: "routes",
  corridors: "routes",
  fees: "fees",
  switches: "fees",
};

export function normalizePaymentSettingsSection(value: string | undefined): PaymentSettingsSection | undefined {
  if (!value) return undefined;
  return SECTION_ALIASES[value];
}

export function visiblePaymentSettingsSections(canAccess: (module: AdminModule) => boolean): PaymentSettingsSection[] {
  return PAYMENT_SETTINGS_TABS.filter((tab) => tab.modules.some((module) => canAccess(module))).map((tab) => tab.id);
}

export function paymentSettingsParams(raw: Record<string, string | string[] | undefined>) {
  const params: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    params[key] = Array.isArray(value) ? value[0] : value;
  }
  return params;
}

export function paymentSettingsHref(section: PaymentSettingsSection, extra?: object, hash?: string) {
  const params = new URLSearchParams();
  params.set("section", section);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (key === "section" || value == null || value === "") continue;
      if (typeof value === "string") params.set(key, value);
      else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string" && item) params.append(key, item);
        }
      }
    }
  }
  const hashPart = hash ? `#${hash.replace(/^#/, "")}` : "";
  return `/admin/payment-settings?${params.toString()}${hashPart}`;
}

export type ReviewLine = { label: string; value: string };

export type SettingsReview = {
  title: string;
  heading: string;
  note: string;
  lines: ReviewLine[];
  checks: ReviewLine[];
};

function filled(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || "Not configured";
}

function check(value: string) {
  return value === "Not configured" ? "Not configured" : "Configured";
}

/** Review shown before a country route save. Values come from the form about to be saved. */
export function countryRouteReview(data: FormData): SettingsReview {
  const country = filled(data.get("countryCode"));
  const currency = filled(data.get("currency"));
  const collection = filled(data.get("collectionProviderCode"));
  const holding = filled(data.get("holdingProviderCode"));
  const payout = filled(data.get("payoutGatewayCode"));
  return {
    title: "Review country route",
    heading: country === "Not configured" ? currency : `${country} · ${currency}`,
    note: "Saving updates this route for new agreements. A deal keeps the route already stored. This save does not move money.",
    lines: [
      { label: "Currency", value: currency },
      { label: "Collection", value: collection },
      { label: "Holding", value: holding },
      { label: "Payout", value: payout },
    ],
    checks: [
      { label: "Collection (receive funds from client)", value: check(collection) },
      { label: "Holding (keep funds in escrow)", value: check(holding) },
      { label: "Payout (send funds to influencer)", value: check(payout) },
    ],
  };
}

/** Review shown before a fee rule save. Signed snapshots stay on the rule they already stored. */
export function feeRuleReview(data: FormData): SettingsReview {
  const name = filled(data.get("name"));
  const purpose = filled(data.get("purpose"));
  const payer = filled(data.get("payer"));
  const country = filled(data.get("jurisdiction"));
  const method = filled(data.get("method"));
  return {
    title: "Fee rule and impact preview",
    heading: name,
    note: "Publishing applies to new agreements only. Existing signed snapshots remain unchanged. This save does not charge a deal.",
    lines: [
      { label: "Purpose", value: purpose },
      { label: "Payer", value: payer },
      { label: "Country", value: country },
      { label: "Method", value: method },
    ],
    checks: [],
  };
}
