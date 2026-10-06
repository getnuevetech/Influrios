import { createHmac, timingSafeEqual } from "crypto";

export type AirwallexSplit = { milestoneId: string; amountCents: number; connectedAccountId: string };

export type AirwallexFundingRequest = {
  fundingId: string;
  amountCents: number;
  currency: string;
  holdingAccountId: string;
  splits: AirwallexSplit[];
};

export function verifyAirwallexSignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const digest = createHmac("sha256", secret).update(body).digest("hex");
  const presented = Buffer.from(signature);
  const expected = Buffer.from(digest);
  if (presented.length !== expected.length) return false;
  return timingSafeEqual(presented, expected);
}

/**
 * Maps an Airwallex payment event onto the marketplace ledger event vocabulary.
 * Domain code never sees Airwallex types; the webhook route calls this then applyMarketplaceEvent.
 */
export function parseAirwallexWebhook(body: string):
  | {
      ok: true;
      eventId: string;
      eventType: "funding.held" | "payout.released" | "payout.refunded";
      fundingId: string;
      amountCents: number;
      milestoneId?: string;
    }
  | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, error: "Invalid JSON." };
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, error: "Invalid payload." };
  const record = parsed as {
    id?: unknown;
    name?: unknown;
    data?: { object?: { id?: unknown; amount?: unknown; metadata?: { fundingId?: unknown; milestoneId?: unknown } } };
  };
  const name = String(record.name ?? "");
  const eventType =
    name === "payment_intent.succeeded"
      ? "funding.held"
      : name === "funds_split.released"
        ? "payout.released"
        : name === "payment_intent.refunded"
          ? "payout.refunded"
          : null;
  const fundingId = record.data?.object?.metadata?.fundingId;
  const amount = record.data?.object?.amount;
  if (!eventType || typeof fundingId !== "string" || typeof record.id !== "string") {
    return { ok: false, error: "Airwallex event is missing a funding id." };
  }
  const amountCents = typeof amount === "number" ? Math.round(amount) : Number(amount);
  if (!Number.isInteger(amountCents) || amountCents < 0) return { ok: false, error: "Amount is invalid." };
  const milestoneId = record.data?.object?.metadata?.milestoneId;
  return {
    ok: true,
    eventId: record.id,
    eventType,
    fundingId,
    amountCents,
    milestoneId: typeof milestoneId === "string" ? milestoneId : undefined,
  };
}

/** One-time mentorship intent. No holding account and no milestone splits. */
export function airwallexMentorshipIntentBody(input: { requestId: string; amountCents: number; currency: string }) {
  return {
    request_id: `mentorship_${input.requestId}`,
    amount: input.amountCents,
    currency: input.currency,
    merchant_order_id: `mentorship_${input.requestId}`,
    metadata: { purpose: "mentorship", requestId: input.requestId },
  };
}

export async function createAirwallexMentorshipIntent(input: {
  baseUrl: string;
  token: string;
  requestId: string;
  amountCents: number;
  currency: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; paymentId: string } | { ok: false; error: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(`${input.baseUrl.replace(/\/$/, "")}/api/v1/pa/payment_intents/create`, {
    method: "POST",
    headers: { authorization: `Bearer ${input.token}`, "content-type": "application/json" },
    body: JSON.stringify(airwallexMentorshipIntentBody(input)),
  });
  const text = await response.text();
  if (!response.ok) return { ok: false, error: text.slice(0, 300) || "Airwallex did not create a payment." };
  let payload: { id?: string; funds_split?: unknown; metadata?: { holdingAccountId?: unknown } };
  try {
    payload = JSON.parse(text) as { id?: string };
  } catch {
    return { ok: false, error: "Airwallex returned an unreadable payment." };
  }
  if (!payload.id) return { ok: false, error: "Airwallex did not return a payment id." };
  return { ok: true, paymentId: payload.id };
}

export function parseAirwallexMentorshipWebhook(body: string):
  | { ok: true; eventId: string; requestId: string; paymentId: string; paid: boolean }
  | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, error: "Invalid JSON." };
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, error: "Invalid payload." };
  const record = parsed as {
    id?: unknown;
    name?: unknown;
    data?: { object?: { id?: unknown; metadata?: { purpose?: unknown; requestId?: unknown } } };
  };
  const purpose = record.data?.object?.metadata?.purpose;
  const requestId = record.data?.object?.metadata?.requestId;
  if (purpose !== "mentorship") return { ok: false, error: "not_mentorship" };
  if (typeof record.id !== "string" || typeof requestId !== "string" || !requestId) {
    return { ok: false, error: "Airwallex mentorship event is missing a request id." };
  }
  const paymentId = typeof record.data?.object?.id === "string" ? record.data.object.id : record.id;
  return {
    ok: true,
    eventId: record.id,
    requestId,
    paymentId,
    paid: record.name === "payment_intent.succeeded",
  };
}

export async function loginAirwallex(input: {
  baseUrl: string;
  clientId: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(`${input.baseUrl.replace(/\/$/, "")}/api/v1/authentication/login`, {
      method: "POST",
      headers: {
        "x-client-id": input.clientId,
        "x-api-key": input.apiKey,
        "content-type": "application/json",
      },
      body: "{}",
      signal: AbortSignal.timeout(8000),
    });
    const text = await response.text();
    if (!response.ok) return { ok: false, error: text.slice(0, 300) || "Airwallex did not return a token. Nothing was charged." };
    const payload = JSON.parse(text) as { token?: string };
    if (!payload.token) return { ok: false, error: "Airwallex did not return a token. Nothing was charged." };
    return { ok: true, token: payload.token };
  } catch {
    return { ok: false, error: "Airwallex did not return a token. Nothing was charged." };
  }
}

export async function createAirwallexFunding(input: {
  baseUrl: string;
  token: string;
  request: AirwallexFundingRequest;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; paymentId: string; splitIds: string[]; url?: string } | { ok: false; error: string }> {
  if (!input.request.holdingAccountId) return { ok: false, error: "Holding account id is required." };
  if (input.request.splits.length < 1) return { ok: false, error: "Each milestone needs a FundsSplit." };
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(`${input.baseUrl.replace(/\/$/, "")}/api/v1/pa/payment_intents/create`, {
    method: "POST",
    headers: { authorization: `Bearer ${input.token}`, "content-type": "application/json" },
    body: JSON.stringify({
      request_id: input.request.fundingId,
      amount: input.request.amountCents,
      currency: input.request.currency,
      merchant_order_id: input.request.fundingId,
      metadata: { fundingId: input.request.fundingId, holdingAccountId: input.request.holdingAccountId },
      funds_split: input.request.splits.map((split) => ({
        destination: split.connectedAccountId,
        amount: split.amountCents,
        metadata: { fundingId: input.request.fundingId, milestoneId: split.milestoneId },
      })),
    }),
  });
  const text = await response.text();
  if (!response.ok) return { ok: false, error: text.slice(0, 300) || "Airwallex did not create a payment." };
  let payload: { id?: string; funds_split?: { id?: string }[] };
  try {
    payload = JSON.parse(text) as { id?: string; funds_split?: { id?: string }[] };
  } catch {
    return { ok: false, error: "Airwallex returned an unreadable payment." };
  }
  if (!payload.id) return { ok: false, error: "Airwallex did not return a payment id." };
  const nextAction = (payload as { next_action?: { url?: string } }).next_action;
  return {
    ok: true,
    paymentId: payload.id,
    url: typeof nextAction?.url === "string" ? nextAction.url : undefined,
    splitIds: (payload.funds_split ?? []).map((split) => split.id).filter((id): id is string => Boolean(id)),
  };
}
