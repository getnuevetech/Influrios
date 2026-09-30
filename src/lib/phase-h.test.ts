import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  confirmedSpecialtySlugs,
  explainMatchFromFactors,
  suggestSpecialties,
} from "./ai-suggest";
import { nextJobStatus } from "./jobs";
import { mailConfigFromEnv } from "./mail";
import { subscriptionStatusForEvent, webhookDisposition } from "./webhook-idempotency";

describe("webhook disposition", () => {
  it("skips a duplicate and applies the subscription events", () => {
    assert.equal(webhookDisposition({ duplicate: true, eventType: "checkout.session.completed" }), "skip");
    assert.equal(webhookDisposition({ duplicate: false, eventType: "checkout.session.completed" }), "apply");
    assert.equal(webhookDisposition({ duplicate: false, eventType: "customer.subscription.deleted" }), "apply");
    assert.equal(webhookDisposition({ duplicate: false, eventType: "invoice.payment_failed" }), "apply");
    assert.equal(webhookDisposition({ duplicate: false, eventType: "customer.created" }), "ignore");
  });

  it("maps event types onto normalized subscription states", () => {
    assert.equal(subscriptionStatusForEvent("checkout.session.completed"), "active");
    assert.equal(subscriptionStatusForEvent("customer.subscription.deleted"), "canceled");
    assert.equal(subscriptionStatusForEvent("invoice.payment_failed"), "past_due");
    assert.equal(subscriptionStatusForEvent("customer.created"), null);
  });
});

describe("specialty suggestions", () => {
  const catalog = [
    { slug: "skincare", name: "Skincare", terms: ["skin"] },
    { slug: "recipes", name: "Recipes" },
  ];

  it("matches catalog words and stays empty when nothing hits", () => {
    const found = suggestSpecialties("A skincare routine for dry skin", catalog, 3);
    assert.equal(found[0]?.slug, "skincare");
    assert.equal(suggestSpecialties("hello", catalog, 3).length, 0);
  });

  it("caps confirmed slugs at the plan limit", () => {
    assert.deepEqual(confirmedSpecialtySlugs(["skincare", "skincare", "recipes"], 1), ["skincare"]);
  });

  it("names the strongest factor and leaves the published explanation stored", () => {
    const text = explainMatchFromFactors([
      { label: "Specialty", value: 40 },
      { label: "Audience", value: 80 },
    ]);
    assert.match(text, /Audience at 80%/);
    assert.match(text, /published explanation/);
  });
});

describe("mail and jobs", () => {
  it("treats SMTP as unconfigured until host and from are both set", () => {
    assert.equal(mailConfigFromEnv({}), null);
    assert.equal(mailConfigFromEnv({ SMTP_HOST: "smtp.example" }), null);
    const ready = mailConfigFromEnv({ SMTP_HOST: "smtp.example", SMTP_FROM: "hello@influrios.com" });
    assert.equal(ready?.host, "smtp.example");
    assert.equal(ready?.from, "hello@influrios.com");
  });

  it("fails a job after three attempts and keeps an earlier failure queued", () => {
    assert.equal(nextJobStatus(1, false), "queued");
    assert.equal(nextJobStatus(2, false), "queued");
    assert.equal(nextJobStatus(3, false), "failed");
    assert.equal(nextJobStatus(3, true), "succeeded");
  });

  it("does not report a test send when SMTP is not configured", async () => {
    if (process.env.SMTP_HOST && process.env.SMTP_FROM) return;
    const { prisma } = await import("./db");
    const row = await prisma.mailSettings.findUnique({ where: { id: "default" } }).catch(() => null);
    if (row?.enabled && row.secretCipher) return;
    const { sendInvitationTest } = await import("./mail");
    const result = await sendInvitationTest("qa@example.com", false);
    assert.equal(result.ok, false);
    assert.match(result.message, /Nothing was sent/);
  });
});

describe("plan apply once", () => {
  it("writes the plan on the first event and leaves it on the duplicate", async () => {
    if (!process.env.DATABASE_URL) return;
    const { prisma } = await import("./db");
    const { applyPlanOnce } = await import("./webhook-idempotency");
    const eventId = `evt_phase_h_${Date.now()}`;
    const email = `phase-h-${Date.now()}@example.com`;
    const user = await prisma.user.create({ data: { email, planTier: "STARTER" } });
    try {
      const first = await applyPlanOnce({
        provider: "stripe",
        eventId,
        eventType: "checkout.session.completed",
        sku: "creator_plus",
        userId: user.id,
        externalId: eventId,
      });
      const second = await applyPlanOnce({
        provider: "stripe",
        eventId,
        eventType: "checkout.session.completed",
        sku: "creator_pro",
        userId: user.id,
        externalId: eventId,
      });
      const stored = await prisma.user.findUnique({ where: { id: user.id } });
      assert.equal(first.applied, true);
      assert.equal(second.applied, false);
      assert.equal(stored?.planTier, "PLUS");
    } finally {
      await prisma.subscriptionState.deleteMany({ where: { userId: user.id } });
      await prisma.processedWebhook.deleteMany({ where: { eventId } });
      await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    }
  });
});
