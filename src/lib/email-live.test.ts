import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { catalogTemplateForCollab, pauseReasonProblem, preferenceAllows } from "@/lib/email-live";
import { emailCatalogTemplate } from "@/lib/email-catalog";
import { publicEmailDelivery } from "@/lib/email-templates";

describe("live catalog mail", () => {
  it("maps the corrected collaboration events onto catalog templates", () => {
    assert.equal(catalogTemplateForCollab("payout_requested", "influencer"), "payout.requested");
    assert.equal(catalogTemplateForCollab("payout_requested", "business"), "payout.requested_business");
    assert.equal(catalogTemplateForCollab("payout_retry", "business"), "payout.retry");
    assert.equal(catalogTemplateForCollab("stale_funding", "admin"), "ops.stale_funding");
    assert.equal(catalogTemplateForCollab("ledger_mismatch", "admin"), "ops.ledger_mismatch");
    assert.equal(catalogTemplateForCollab("payout_returned", "influencer"), "payout.returned");
    assert.equal(catalogTemplateForCollab("payout_returned", "business"), "payout.returned_business");
    assert.equal(catalogTemplateForCollab("milestone_approved", "business"), "milestone.approved");
    const jobs = readFileSync(new URL("./jobs.ts", import.meta.url), "utf8");
    assert.match(jobs, /kind: "payout_requested"/);
    assert.match(jobs, /kind: "payout_retry"/);
    assert.match(jobs, /kind: "stale_funding"/);
    assert.match(jobs, /kind: "ledger_mismatch"/);
    assert.equal(jobs.includes('kind: "milestone_approved"'), false);
  });

  it("requires an audited reason before an essential template can pause", () => {
    assert.match(pauseReasonProblem("account.verify", "no"), /8 characters/);
    assert.equal(pauseReasonProblem("account.verify", "Provider outage"), "");
    assert.equal(pauseReasonProblem("marketing.broadcast", "off"), "");
  });

  it("keeps security mail on and lets a member turn product news off", () => {
    const verify = emailCatalogTemplate("account.verify");
    const news = emailCatalogTemplate("marketing.broadcast");
    const claim = emailCatalogTemplate("account.claim");
    assert.ok(verify && news && claim);
    const preference = { collaborations: false, billing: false, outreach: false, productNews: false };
    assert.equal(preferenceAllows(verify, preference), true);
    assert.equal(preferenceAllows(news, preference), false);
    assert.equal(preferenceAllows(claim, preference), false);
  });

  it("logs a template test without a verification code", () => {
    const row = publicEmailDelivery({
      id: "job_test",
      kind: "catalog_email",
      status: "succeeded",
      createdAt: new Date("2026-11-12T18:00:00Z"),
      lastError: null,
      payload: { to: "alex@example.com", subject: "Account security email", templateKey: "account.verify" },
    });
    assert.equal(JSON.stringify(row).includes("482619"), false);
    assert.equal(row.to, "alex@example.com");
    assert.equal(row.subject, "Account security email");
  });
});
