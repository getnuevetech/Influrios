import { createHmac, timingSafeEqual } from "crypto";
import { splitMilestoneRelease } from "@/lib/account-purpose";
import { shareLines } from "@/lib/fx-share";

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
        auto_release: false,
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

/** Creator splits only. The platform fee stays in holding until the release webhook. */
export function fundingSplitPlan(input: {
  milestones: { id: string; amountCents: number; title?: string }[];
  grossCents: number;
  feeCents: number;
  financialPlan?: unknown;
  connectedAccountId: string;
  parties?: { label: string; shareBps: number; connectedAccountId: string }[] | null;
}): { ok: true; splits: AirwallexSplit[]; holdingFeeCents: number } | { ok: false; error: string } {
  const parties = input.parties && input.parties.length >= 2 ? input.parties : null;
  if (!parties && !input.connectedAccountId.trim()) {
    return { ok: false, error: "A connected account is required. Nothing was charged." };
  }
  if (input.milestones.length < 1) return { ok: false, error: "Each milestone needs a FundsSplit." };
  const splits: AirwallexSplit[] = [];
  let holdingFeeCents = 0;
  for (let index = 0; index < input.milestones.length; index += 1) {
    const milestone = input.milestones[index];
    const legs = splitMilestoneRelease({
      releasableCents: milestone.amountCents,
      fundingGrossCents: input.grossCents,
      fundingFeeCents: input.feeCents,
      financialPlanJson: input.financialPlan,
      milestoneTitle: milestone.title,
      milestoneIndex: index,
    });
    holdingFeeCents += legs.feeCents;
    if (legs.creatorCents <= 0) continue;
    if (!parties) {
      splits.push({
        milestoneId: milestone.id,
        amountCents: legs.creatorCents,
        connectedAccountId: input.connectedAccountId,
      });
      continue;
    }
    const lines = shareLines(legs.creatorCents, parties);
    if (!lines) return { ok: false, error: "Creator shares must add up to 100%. Nothing was charged." };
    for (const line of lines) {
      const party = parties.find((row) => row.label === line.label);
      if (!party || line.amountCents <= 0) continue;
      splits.push({
        milestoneId: milestone.id,
        amountCents: line.amountCents,
        connectedAccountId: party.connectedAccountId,
      });
    }
  }
  if (splits.length < 1) return { ok: false, error: "Each milestone needs a FundsSplit." };
  return { ok: true, splits, holdingFeeCents };
}

/** Fee stays in holding through intent, hold, and approval. It moves on the release webhook. */
export function feeHoldingSnapshot(input: {
  grossCents: number;
  feeCents: number;
  stage: "intent" | "held" | "approved" | "released";
}): { holdingCents: number; operationsFeeCents: number } {
  if (input.stage === "released") {
    return { holdingCents: 0, operationsFeeCents: input.feeCents };
  }
  return { holdingCents: input.grossCents, operationsFeeCents: 0 };
}

/** An Airwallex intent exists only when the jurisdiction list includes this rail. An empty list does not. */
export function jurisdictionAllowsAirwallexIntent(approvedProviderIds: readonly string[]): { ok: true } | { ok: false; error: string } {
  const allowed = approvedProviderIds.map((id) => id.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes("airwallex")) {
    return { ok: false, error: "This jurisdiction does not list Airwallex. Nothing was charged." };
  }
  return { ok: true };
}

export function splitIdsForMilestone(value: unknown, milestoneId: string, columnId?: string | null): string[] {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const raw = (value as Record<string, unknown>)[milestoneId];
    if (typeof raw === "string" && raw.trim()) return [raw.trim()];
    if (Array.isArray(raw)) {
      return raw.filter((id): id is string => typeof id === "string" && Boolean(id.trim())).map((id) => id.trim());
    }
  }
  return columnId?.trim() ? [columnId.trim()] : [];
}

export function airwallexIntroFeeIntentBody(input: { intentRef: string; introId: string; amountCents: number; currency: string }) {
  return {
    request_id: input.intentRef,
    amount: input.amountCents,
    currency: input.currency,
    merchant_order_id: input.intentRef,
    metadata: { purpose: "intro_fee", intentRef: input.intentRef, introId: input.introId },
  };
}

export function parseAirwallexIntroFeeWebhook(body: string):
  | { ok: true; eventId: string; intentRef: string; paymentId: string; paid: boolean }
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
    data?: { object?: { id?: unknown; metadata?: { purpose?: unknown; intentRef?: unknown } } };
  };
  if (record.data?.object?.metadata?.purpose !== "intro_fee") return { ok: false, error: "not_intro_fee" };
  const intentRef = record.data?.object?.metadata?.intentRef;
  if (typeof record.id !== "string" || typeof intentRef !== "string" || !intentRef) {
    return { ok: false, error: "Airwallex intro fee event is missing an intent reference." };
  }
  const paymentId = typeof record.data?.object?.id === "string" ? record.data.object.id : record.id;
  return { ok: true, eventId: record.id, intentRef, paymentId, paid: record.name === "payment_intent.succeeded" };
}

export type CorridorCapabilityPatch = {
  accountType?: string;
  currencies?: string[];
  payoutMethod?: string;
};

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function currencyList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim().toUpperCase();
      if (item && typeof item === "object" && "currency" in item && typeof item.currency === "string") {
        return item.currency.trim().toUpperCase();
      }
      return "";
    })
    .filter((code) => /^[A-Z]{3}$/.test(code));
}

/** Copies account type, currencies, and payout method only when the payload includes them. */
export function capabilityPatchFromAirwallex(payload: unknown): CorridorCapabilityPatch {
  if (!payload || typeof payload !== "object") return {};
  const row = payload as Record<string, unknown>;
  const nested = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : null;
  const source = firstText(row.account_type, row.accountType, row.payout_method, row.payoutMethod) || currencyList(row.currencies ?? row.supported_currencies).length
    ? row
    : nested ?? row;
  const patch: CorridorCapabilityPatch = {};
  const accountType = firstText(source.account_type, source.accountType);
  if (accountType) patch.accountType = accountType.slice(0, 80);
  const currencies = currencyList(source.currencies ?? source.supported_currencies);
  if (currencies.length > 0) patch.currencies = currencies;
  const payoutMethod = firstText(source.payout_method, source.payoutMethod);
  if (payoutMethod) patch.payoutMethod = payoutMethod.slice(0, 80);
  return patch;
}

export function capabilityRowData(patch: CorridorCapabilityPatch): {
  accountType?: string;
  currenciesJson?: string[];
  payoutMethod?: string;
} {
  const data: { accountType?: string; currenciesJson?: string[]; payoutMethod?: string } = {};
  if (patch.accountType) data.accountType = patch.accountType;
  if (patch.currencies && patch.currencies.length > 0) data.currenciesJson = patch.currencies;
  if (patch.payoutMethod) data.payoutMethod = patch.payoutMethod;
  return data;
}

type AirwallexFetch = {
  baseUrl: string;
  token: string;
  path: string;
  method: "GET" | "POST";
  body?: unknown;
  fetchImpl?: typeof fetch;
};

async function airwallexRequest(input: AirwallexFetch): Promise<{ ok: true; payload: Record<string, unknown> } | { ok: false; error: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(`${input.baseUrl.replace(/\/$/, "")}${input.path}`, {
    method: input.method,
    headers: { authorization: `Bearer ${input.token}`, "content-type": "application/json" },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
  const text = await response.text();
  if (!response.ok) return { ok: false, error: text.slice(0, 300) || "Airwallex did not accept the request." };
  if (!text.trim()) return { ok: true, payload: {} };
  try {
    const payload = JSON.parse(text) as unknown;
    if (!payload || typeof payload !== "object") return { ok: false, error: "Airwallex returned an unreadable response." };
    return { ok: true, payload: payload as Record<string, unknown> };
  } catch {
    return { ok: false, error: "Airwallex returned an unreadable response." };
  }
}

export async function getAirwallexFundingStatus(input: {
  baseUrl: string;
  token: string;
  paymentId: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const read = await airwallexRequest({
    baseUrl: input.baseUrl,
    token: input.token,
    path: `/api/v1/pa/payment_intents/${encodeURIComponent(input.paymentId)}`,
    method: "GET",
    fetchImpl: input.fetchImpl,
  });
  if (!read.ok) return read;
  const status = typeof read.payload.status === "string" ? read.payload.status : "";
  if (!status) return { ok: false, error: "Airwallex did not return a payment status." };
  return { ok: true, status };
}

export async function cancelAirwallexFunding(input: {
  baseUrl: string;
  token: string;
  paymentId: string;
  requestId: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; paymentId: string; booked: false } | { ok: false; error: string }> {
  const read = await airwallexRequest({
    baseUrl: input.baseUrl,
    token: input.token,
    path: `/api/v1/pa/payment_intents/${encodeURIComponent(input.paymentId)}/cancel`,
    method: "POST",
    body: { request_id: input.requestId, cancellation_reason: "requested_by_customer" },
    fetchImpl: input.fetchImpl,
  });
  if (!read.ok) return read;
  return { ok: true, paymentId: input.paymentId, booked: false };
}

export async function releaseAirwallexSplit(input: {
  baseUrl: string;
  token: string;
  splitId: string;
  requestId: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; splitId: string; booked: false } | { ok: false; error: string }> {
  const read = await airwallexRequest({
    baseUrl: input.baseUrl,
    token: input.token,
    path: `/api/v1/pa/funds_splits/${encodeURIComponent(input.splitId)}/release`,
    method: "POST",
    body: { request_id: input.requestId },
    fetchImpl: input.fetchImpl,
  });
  if (!read.ok) return read;
  return { ok: true, splitId: input.splitId, booked: false };
}

export async function refundAirwallexPayment(input: {
  baseUrl: string;
  token: string;
  paymentId: string;
  requestId: string;
  amountCents?: number;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; refundId: string; booked: false } | { ok: false; error: string }> {
  const body: { request_id: string; payment_intent_id: string; reason: string; amount?: number } = {
    request_id: input.requestId,
    payment_intent_id: input.paymentId,
    reason: "requested_by_customer",
  };
  if (input.amountCents != null) body.amount = input.amountCents;
  const read = await airwallexRequest({
    baseUrl: input.baseUrl,
    token: input.token,
    path: "/api/v1/pa/refunds/create",
    method: "POST",
    body,
    fetchImpl: input.fetchImpl,
  });
  if (!read.ok) return read;
  const refundId = typeof read.payload.id === "string" ? read.payload.id : input.requestId;
  return { ok: true, refundId, booked: false };
}

export async function getAirwallexPayoutStatus(input: {
  baseUrl: string;
  token: string;
  splitId: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
  const read = await airwallexRequest({
    baseUrl: input.baseUrl,
    token: input.token,
    path: `/api/v1/pa/funds_splits/${encodeURIComponent(input.splitId)}`,
    method: "GET",
    fetchImpl: input.fetchImpl,
  });
  if (!read.ok) return read;
  const status = typeof read.payload.status === "string" ? read.payload.status : "";
  if (!status) return { ok: false, error: "Airwallex did not return a payout status." };
  return { ok: true, status };
}

export async function reconcileAirwallexTransaction(input: {
  baseUrl: string;
  token: string;
  paymentId: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; status: string; booked: false } | { ok: false; error: string }> {
  const status = await getAirwallexFundingStatus(input);
  if (!status.ok) return status;
  return { ok: true, status: status.status, booked: false };
}

export async function createAirwallexIntroFeeIntent(input: {
  baseUrl: string;
  token: string;
  intentRef: string;
  introId: string;
  amountCents: number;
  currency: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; paymentId: string; url?: string } | { ok: false; error: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(`${input.baseUrl.replace(/\/$/, "")}/api/v1/pa/payment_intents/create`, {
    method: "POST",
    headers: { authorization: `Bearer ${input.token}`, "content-type": "application/json" },
    body: JSON.stringify(airwallexIntroFeeIntentBody(input)),
  });
  const text = await response.text();
  if (!response.ok) return { ok: false, error: text.slice(0, 300) || "Airwallex did not create a payment." };
  let payload: { id?: string; next_action?: { url?: string }; funds_split?: unknown };
  try {
    payload = JSON.parse(text) as { id?: string };
  } catch {
    return { ok: false, error: "Airwallex returned an unreadable payment." };
  }
  if (!payload.id) return { ok: false, error: "Airwallex did not return a payment id." };
  return {
    ok: true,
    paymentId: payload.id,
    url: typeof payload.next_action?.url === "string" ? payload.next_action.url : undefined,
  };
}

export async function createAirwallexConnectedAccount(input: {
  baseUrl: string;
  token: string;
  email: string;
  requestId: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; accountId: string; url?: string } | { ok: false; error: string }> {
  const read = await airwallexRequest({
    baseUrl: input.baseUrl,
    token: input.token,
    path: "/api/v1/accounts/create",
    method: "POST",
    body: {
      request_id: input.requestId,
      primary_contact: { email: input.email },
      customer_agreements: { agreed_to_data_usage: true, agreed_to_terms_and_conditions: true },
    },
    fetchImpl: input.fetchImpl,
  });
  if (!read.ok) return read;
  const accountId = typeof read.payload.id === "string" ? read.payload.id.trim() : "";
  if (!accountId) return { ok: false, error: "Airwallex did not return a connected account id. Nothing was stored." };
  const nextAction = read.payload.next_action as { url?: string } | undefined;
  const url = typeof nextAction?.url === "string" ? nextAction.url : typeof read.payload.url === "string" ? read.payload.url : undefined;
  return { ok: true, accountId, url };
}

export async function fetchAirwallexCountryCapability(input: {
  baseUrl: string;
  token: string;
  countryCode: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; payload: unknown } | { ok: false; error: string }> {
  const read = await airwallexRequest({
    baseUrl: input.baseUrl,
    token: input.token,
    path: `/api/v1/reference/country_capabilities?country_code=${encodeURIComponent(input.countryCode)}`,
    method: "GET",
    fetchImpl: input.fetchImpl,
  });
  if (!read.ok) return read;
  return { ok: true, payload: read.payload };
}
