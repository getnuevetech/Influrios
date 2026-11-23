import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readSupportSettings, validateSupportMessage } from "@/lib/support";
import { collabEmailPath } from "@/lib/collab-email-links";
import { liveMailLinks } from "@/lib/email-live";

describe("support contact", () => {
  it("keeps only a valid support address", () => {
    assert.equal(readSupportSettings({ email: " Help@Influrios.example " }).email, "help@influrios.example");
    assert.equal(readSupportSettings({ email: "not an address" }).email, "");
    assert.equal(readSupportSettings(null).email, "");
  });

  it("validates the contact form and drops bot submissions", () => {
    const ok = validateSupportMessage({ name: "Ada", email: "ada@example.com", topic: "Payments and payouts", message: "My payout is missing." });
    assert.equal(ok.ok, true);
    assert.equal(ok.ok && ok.value.topic, "Payments and payouts");
    assert.equal(validateSupportMessage({ name: "Ada", email: "ada@example.com", topic: "x", message: "short" }).ok, false);
    assert.equal(validateSupportMessage({ name: "", email: "ada@example.com", topic: "x", message: "long enough message" }).ok, false);
    assert.equal(validateSupportMessage({ name: "Ada", email: "nope", topic: "x", message: "long enough message" }).ok, false);
    const bot = validateSupportMessage({ name: "Ada", email: "ada@example.com", topic: "x", message: "long enough message", website: "http://spam" });
    assert.equal(!bot.ok && bot.error, "spam");
    const other = validateSupportMessage({ name: "Ada", email: "ada@example.com", topic: "made up", message: "long enough message" });
    assert.equal(other.ok && other.value.topic, "Something else");
  });

  it("every email's support link opens the support page", () => {
    assert.match(liveMailLinks().support_url, /\/support$/);
    assert.ok(collabEmailPath("payout.confirmed", { fundingId: "f", milestoneId: "m" }));
  });
});
