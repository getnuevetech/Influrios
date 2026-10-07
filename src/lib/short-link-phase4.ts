/** INFLR.me phase 4 path and entitlement rules. No database. */

const CAMPAIGN_CODE_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

export type ShortPath =
  | { kind: "root" }
  | { kind: "qr"; token: string }
  | { kind: "nfc"; token: string }
  | { kind: "campaign"; code: string }
  | { kind: "slug"; slug: string }
  | { kind: "unknown" };

export function parseShortPath(path: string): ShortPath {
  const clean = path.split("?")[0].replace(/\/+$/, "") || "/";
  if (clean === "/") return { kind: "root" };
  const qr = clean.match(/^\/q\/([A-Za-z0-9_-]{4,80})$/);
  if (qr) return { kind: "qr", token: qr[1] };
  const nfc = clean.match(/^\/n\/([A-Za-z0-9_-]{4,80})$/);
  if (nfc) return { kind: "nfc", token: nfc[1] };
  const campaign = clean.match(/^\/c\/([a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9]))$/);
  if (campaign && !campaign[1].includes("--")) return { kind: "campaign", code: campaign[1] };
  const slug = clean.match(/^\/([a-z0-9][a-z0-9-]{1,30})$/);
  if (slug) return { kind: "slug", slug: slug[1] };
  return { kind: "unknown" };
}

export function normalizeCampaignCode(input: string, reserved: readonly string[]): string | null {
  const code = input.trim().toLowerCase().replace(/^@/, "").replace(/\s+/g, "");
  if (!CAMPAIGN_CODE_RE.test(code) || code.includes("--")) return null;
  if (reserved.includes(code)) return null;
  return code;
}

/** campaignMax is the plan feature card.campaign_links.max. It is not the short-link cap. */
export function canAddCampaignLink(input: { campaignMax: number; campaignCount: number }): boolean {
  if (input.campaignMax < 1) return false;
  return input.campaignCount < input.campaignMax;
}

export function scheduleIsDue(input: { status: string; startsAt: Date; now: Date }): boolean {
  return input.status === "pending" && input.startsAt.getTime() <= input.now.getTime();
}

export function scheduleStartsInFuture(startsAt: Date, now: Date): boolean {
  return startsAt.getTime() > now.getTime() + 60_000;
}
