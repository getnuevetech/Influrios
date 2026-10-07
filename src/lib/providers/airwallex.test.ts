import assert from "node:assert/strict";
import { createHmac } from "crypto";
import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { describe, it } from "node:test";
import {
  airwallexIntroFeeIntentBody,
  airwallexMentorshipIntentBody,
  cancelAirwallexFunding,
  capabilityPatchFromAirwallex,
  capabilityRowData,
  createAirwallexFunding,
  feeHoldingSnapshot,
  fundingSplitPlan,
  getAirwallexFundingStatus,
  getAirwallexPayoutStatus,
  jurisdictionAllowsAirwallexIntent,
  parseAirwallexIntroFeeWebhook,
  parseAirwallexMentorshipWebhook,
  parseAirwallexWebhook,
  refundAirwallexPayment,
  releaseAirwallexSplit,
  verifyAirwallexSignature,
} from "./airwallex";

describe("Airwallex adapter", () => {
  const secret = "awx-secret";
  const held = JSON.stringify({
    id: "evt-1",
    name: "payment_intent.succeeded",
    data: { object: { id: "int-1", amount: 5000, metadata: { fundingId: "fund-1" } } },
  });

  it("verifies the webhook and maps hold and release without double-parsing a new id", () => {
    const signature = createHmac("sha256", secret).update(held).digest("hex");
    assert.equal(verifyAirwallexSignature(held, signature, secret), true);
    assert.equal(verifyAirwallexSignature(held, "nope", secret), false);
    const parsed = parseAirwallexWebhook(held);
    assert.equal(parsed.ok && parsed.eventType, "funding.held");
    assert.equal(parsed.ok && parsed.eventId, "evt-1");
    const again = parseAirwallexWebhook(held);
    assert.equal(again.ok && parsed.ok && again.eventId === parsed.eventId, true);
  });

  it("creates one payment with a split per milestone to the same connected account", async () => {
    let seen = "";
    const result = await createAirwallexFunding({
      baseUrl: "https://api-demo.airwallex.com",
      token: "token",
      request: {
        fundingId: "fund-1",
        amountCents: 5000,
        currency: "USD",
        holdingAccountId: "hold-acct",
        splits: [
          { milestoneId: "m1", amountCents: 2500, connectedAccountId: "acct-creator" },
          { milestoneId: "m2", amountCents: 2500, connectedAccountId: "acct-creator" },
        ],
      },
      fetchImpl: async (_url, init) => {
        seen = String(init?.body ?? "");
        return new Response(JSON.stringify({ id: "int-1", funds_split: [{ id: "s1" }, { id: "s2" }] }), { status: 201 });
      },
    });
    assert.equal(result.ok && result.splitIds.length, 2);
    assert.match(seen, /acct-creator/);
    assert.match(seen, /hold-acct/);
    assert.match(seen, /"auto_release":false/);
  });

  it("builds a mentorship intent with no holding account and no splits", () => {
    const body = airwallexMentorshipIntentBody({ requestId: "req-1", amountCents: 4900, currency: "USD" });
    assert.equal(body.metadata.purpose, "mentorship");
    assert.equal("holdingAccountId" in body, false);
    assert.equal("funds_split" in body, false);
    const payload = JSON.stringify({
      id: "evt-m",
      name: "payment_intent.succeeded",
      data: { object: { id: "int-m", metadata: { purpose: "mentorship", requestId: "req-1" } } },
    });
    const parsed = parseAirwallexMentorshipWebhook(payload);
    assert.equal(parsed.ok && parsed.paid, true);
    assert.equal(parsed.ok && parsed.requestId, "req-1");
    const funding = parseAirwallexMentorshipWebhook(held);
    assert.equal(funding.ok, false);
    if (!funding.ok) assert.equal(funding.error, "not_mentorship");
  });

  it("keeps the fee in holding until the release webhook and aims splits at the creator", () => {
    const plan = fundingSplitPlan({
      milestones: [
        { id: "m1", amountCents: 2500, title: "One" },
        { id: "m2", amountCents: 2500, title: "Two" },
      ],
      grossCents: 5000,
      feeCents: 1000,
      connectedAccountId: "acct-creator",
    });
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.equal(plan.holdingFeeCents, 1000);
    assert.equal(plan.splits.length, 2);
    assert.ok(plan.splits.every((split) => split.connectedAccountId === "acct-creator"));
    assert.equal(
      plan.splits.reduce((sum, split) => sum + split.amountCents, 0) + plan.holdingFeeCents,
      5000,
    );
    assert.equal(feeHoldingSnapshot({ grossCents: 5000, feeCents: 1000, stage: "held" }).holdingCents, 5000);
    assert.equal(feeHoldingSnapshot({ grossCents: 5000, feeCents: 1000, stage: "approved" }).operationsFeeCents, 0);
    const releasedFee = feeHoldingSnapshot({ grossCents: 5000, feeCents: 1000, stage: "released" });
    assert.equal(releasedFee.operationsFeeCents, 1000);
    assert.equal(releasedFee.holdingCents, 0);
    const team = fundingSplitPlan({
      milestones: [{ id: "m1", amountCents: 5000, title: "One" }],
      grossCents: 5000,
      feeCents: 0,
      connectedAccountId: "acct-a",
      parties: [
        { label: "a", shareBps: 5000, connectedAccountId: "acct-a" },
        { label: "b", shareBps: 5000, connectedAccountId: "acct-b" },
      ],
    });
    assert.equal(team.ok && team.splits.length, 2);
    if (team.ok) assert.deepEqual(team.splits.map((split) => split.connectedAccountId).sort(), ["acct-a", "acct-b"]);
  });

  it("refuses an intent when the jurisdiction does not list the rail", () => {
    assert.equal(jurisdictionAllowsAirwallexIntent([]).ok, false);
    assert.equal(jurisdictionAllowsAirwallexIntent(["primary"]).ok, false);
    assert.equal(jurisdictionAllowsAirwallexIntent(["airwallex"]).ok, true);
  });

  it("follows intent, hold, release, and a duplicate release event without booking on the release call", async () => {
    const calls: string[] = [];
    const created = await createAirwallexFunding({
      baseUrl: "https://api-demo.airwallex.com",
      token: "token",
      request: {
        fundingId: "fund-1",
        amountCents: 5000,
        currency: "USD",
        holdingAccountId: "hold-acct",
        splits: [
          { milestoneId: "m1", amountCents: 2500, connectedAccountId: "acct-creator" },
          { milestoneId: "m2", amountCents: 2500, connectedAccountId: "acct-creator" },
        ],
      },
      fetchImpl: async (url) => {
        calls.push(String(url));
        return new Response(JSON.stringify({ id: "int-1", funds_split: [{ id: "s1" }, { id: "s2" }] }), { status: 201 });
      },
    });
    assert.equal(created.ok && created.paymentId, "int-1");
    const heldBody = JSON.stringify({
      id: "evt-held",
      name: "payment_intent.succeeded",
      data: { object: { id: "int-1", amount: 5000, metadata: { fundingId: "fund-1" } } },
    });
    const heldEvent = parseAirwallexWebhook(heldBody);
    assert.equal(heldEvent.ok && heldEvent.eventType, "funding.held");
    const released = await releaseAirwallexSplit({
      baseUrl: "https://api-demo.airwallex.com",
      token: "token",
      splitId: "s1",
      requestId: "release_fund-1_m1_s1",
      fetchImpl: async (url, init) => {
        calls.push(`${url} ${init?.body}`);
        return new Response(JSON.stringify({ id: "s1", status: "RELEASED" }), { status: 200 });
      },
    });
    assert.equal(released.ok, true);
    if (released.ok) assert.equal(released.booked, false);
    assert.match(calls.at(-1) ?? "", /funds_splits\/s1\/release/);
    const releaseBody = JSON.stringify({
      id: "evt-rel",
      name: "funds_split.released",
      data: { object: { id: "s1", amount: 2500, metadata: { fundingId: "fund-1", milestoneId: "m1" } } },
    });
    const releaseEvent = parseAirwallexWebhook(releaseBody);
    const duplicate = parseAirwallexWebhook(releaseBody);
    assert.equal(releaseEvent.ok && releaseEvent.eventType, "payout.released");
    assert.equal(releaseEvent.ok && duplicate.ok && releaseEvent.eventId === duplicate.eventId, true);
    const seen = new Set<string>();
    if (releaseEvent.ok) seen.add(releaseEvent.eventId);
    assert.equal(duplicate.ok && seen.has(duplicate.eventId), true);
  });

  it("reads status, cancels, refunds, and reconciles without a ledger write in the client", async () => {
    const urls: string[] = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      urls.push(`${url} ${init?.body ?? ""}`);
      return new Response(JSON.stringify({ id: "int-1", status: "SUCCEEDED" }), { status: 200 });
    };
    const status = await getAirwallexFundingStatus({
      baseUrl: "https://api-demo.airwallex.com",
      token: "token",
      paymentId: "int-1",
      fetchImpl,
    });
    assert.equal(status.ok && status.status, "SUCCEEDED");
    const cancelled = await cancelAirwallexFunding({
      baseUrl: "https://api-demo.airwallex.com",
      token: "token",
      paymentId: "int-1",
      requestId: "cancel_int-1",
      fetchImpl,
    });
    assert.equal(cancelled.ok, true);
    if (cancelled.ok) assert.equal(cancelled.booked, false);
    const partial = await refundAirwallexPayment({
      baseUrl: "https://api-demo.airwallex.com",
      token: "token",
      paymentId: "int-1",
      requestId: "refund_1",
      amountCents: 500,
      fetchImpl,
    });
    assert.equal(partial.ok, true);
    if (partial.ok) assert.equal(partial.booked, false);
    assert.match(urls.at(-1) ?? "", /"amount":500/);
    const full = await refundAirwallexPayment({
      baseUrl: "https://api-demo.airwallex.com",
      token: "token",
      paymentId: "int-1",
      requestId: "refund_full",
      fetchImpl,
    });
    assert.equal(full.ok, true);
    if (full.ok) assert.equal(full.booked, false);
    assert.equal((urls.at(-1) ?? "").includes('"amount"'), false);
    const payout = await getAirwallexPayoutStatus({
      baseUrl: "https://api-demo.airwallex.com",
      token: "token",
      splitId: "s1",
      fetchImpl,
    });
    assert.equal(payout.ok && payout.status, "SUCCEEDED");
    assert.match(urls[0] ?? "", /payment_intents\/int-1/);
  });

  it("builds an intro fee intent with no holding account and no splits", () => {
    const body = airwallexIntroFeeIntentBody({
      intentRef: "intro_fee_1",
      introId: "intro-1",
      amountCents: 1500,
      currency: "USD",
    });
    assert.equal(body.metadata.purpose, "intro_fee");
    assert.equal("funds_split" in body, false);
    assert.equal("holdingAccountId" in body, false);
    const payload = JSON.stringify({
      id: "evt-i",
      name: "payment_intent.succeeded",
      data: { object: { id: "int-i", metadata: { purpose: "intro_fee", intentRef: "intro_fee_1" } } },
    });
    const parsed = parseAirwallexIntroFeeWebhook(payload);
    assert.equal(parsed.ok && parsed.paid && parsed.intentRef, "intro_fee_1");
    const funding = parseAirwallexIntroFeeWebhook(held);
    assert.equal(funding.ok, false);
    if (!funding.ok) assert.equal(funding.error, "not_intro_fee");
  });

  it("writes only capability fields the sandbox payload includes", () => {
    const currencies = capabilityPatchFromAirwallex({ currencies: ["usd", "eur"] });
    assert.deepEqual(currencies, { currencies: ["USD", "EUR"] });
    assert.equal("accountType" in currencies, false);
    assert.deepEqual(capabilityRowData(currencies), { currenciesJson: ["USD", "EUR"] });
    assert.deepEqual(capabilityPatchFromAirwallex({ note: "ignore me" }), {});
    assert.deepEqual(capabilityPatchFromAirwallex({ data: { account_type: "individual", payout_method: "local_bank" } }), {
      accountType: "individual",
      payoutMethod: "local_bank",
    });
  });

  it("keeps the provider name out of collaboration domain modules", () => {
    const allow = new Set([
      "src/lib/providers/airwallex.ts",
      "src/lib/providers/airwallex-config.ts",
      "src/lib/providers/airwallex-runtime.ts",
      "src/lib/providers.ts",
      "src/lib/provider-collection.ts",
      "src/lib/mentorship.ts",
      "src/lib/faq-catalog.ts",
      "src/lib/payment-provider-adapter.ts",
    ]);
    const root = path.resolve("src/lib");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!full.endsWith(".ts") || full.endsWith(".test.ts")) continue;
        const rel = path.relative(process.cwd(), full).split(path.sep).join("/");
        if (allow.has(rel)) continue;
        if (/airwallex/i.test(readFileSync(full, "utf8"))) hits.push(rel);
      }
    };
    walk(root);
    assert.deepEqual(hits, []);
    const ledger = readFileSync(path.resolve("src/lib/marketplace-ledger.ts"), "utf8");
    assert.equal(ledger.includes("providers/airwallex"), false);
  });
});
