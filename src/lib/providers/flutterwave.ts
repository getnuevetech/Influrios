import { timingSafeEqual } from "crypto";

export type RegionalCharge = {
  provider: "flutterwave" | "mpesa";
  eventId: string;
  txRef: string;
  paid: boolean;
  amountCents: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** Flutterwave sends the webhook secret itself in `verif-hash`. */
export function verifyFlutterwaveSignature(header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const presented = Buffer.from(header);
  const expected = Buffer.from(secret);
  if (presented.length !== expected.length) return false;
  return timingSafeEqual(presented, expected);
}

export function parseFlutterwaveWebhook(body: string): { ok: true; charge: RegionalCharge } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, error: "Invalid JSON." };
  }
  const root = asRecord(parsed);
  const data = asRecord(root?.data);
  if (!root || !data) return { ok: false, error: "Invalid payload." };
  const txRef = typeof data.tx_ref === "string" ? data.tx_ref : "";
  const id = data.id != null ? String(data.id) : "";
  if (!txRef || !id) return { ok: false, error: "Flutterwave event is missing a charge id." };
  const status = String(data.status ?? "").toLowerCase();
  const amount = typeof data.amount === "number" ? data.amount : Number(data.amount);
  const amountCents = Number.isFinite(amount) ? Math.round(amount * 100) : 0;
  return {
    ok: true,
    charge: {
      provider: "flutterwave",
      eventId: `flutterwave:${id}`,
      txRef,
      paid: status === "successful",
      amountCents,
    },
  };
}

export function flutterwaveChargeBody(input: {
  txRef: string;
  amountCents: number;
  currency: string;
  email: string;
}) {
  return {
    tx_ref: input.txRef,
    amount: input.amountCents / 100,
    currency: input.currency,
    payment_options: "card",
    customer: { email: input.email },
  };
}

export async function createFlutterwaveCharge(input: {
  secret: string;
  baseUrl?: string;
  txRef: string;
  amountCents: number;
  currency: string;
  email: string;
  redirectUrl: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; chargeId: string; link: string } | { ok: false; error: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const base = (input.baseUrl || "https://api.flutterwave.com").replace(/\/$/, "");
  try {
    const response = await fetchImpl(`${base}/v3/payments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${input.secret}`, "content-type": "application/json" },
      body: JSON.stringify({
        ...flutterwaveChargeBody(input),
        redirect_url: input.redirectUrl,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    const json = (await response.json().catch(() => null)) as {
      status?: string;
      data?: { link?: string; id?: number };
      message?: string;
    } | null;
    if (!response.ok || json?.status !== "success" || !json.data?.link) {
      return { ok: false, error: json?.message || "Flutterwave did not open a charge." };
    }
    return { ok: true, chargeId: String(json.data.id ?? input.txRef), link: json.data.link };
  } catch {
    return { ok: false, error: "Flutterwave did not accept the charge." };
  }
}
