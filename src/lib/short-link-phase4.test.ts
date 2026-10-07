import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAddCampaignLink,
  normalizeCampaignCode,
  parseShortPath,
  scheduleIsDue,
  scheduleStartsInFuture,
} from "./short-link-phase4";

const reserved = ["admin", "c", "q"];

describe("INFLR.me phase 4 paths", () => {
  it("classifies root, QR, NFC, campaign, and slug paths", () => {
    assert.deepEqual(parseShortPath("/"), { kind: "root" });
    assert.deepEqual(parseShortPath("/q/abc123"), { kind: "qr", token: "abc123" });
    assert.deepEqual(parseShortPath("/n/tap-token"), { kind: "nfc", token: "tap-token" });
    assert.deepEqual(parseShortPath("/c/spring-launch"), { kind: "campaign", code: "spring-launch" });
    assert.deepEqual(parseShortPath("/sofia"), { kind: "slug", slug: "sofia" });
  });

  it("rejects short, reserved-looking, and double-hyphen campaign paths at parse time", () => {
    assert.equal(parseShortPath("/c/ab").kind, "unknown");
    assert.equal(parseShortPath("/c/spring--launch").kind, "unknown");
    assert.equal(parseShortPath("/n/ab").kind, "unknown");
    assert.deepEqual(parseShortPath("/c/admin"), { kind: "campaign", code: "admin" });
  });

  it("normalizes campaign codes and rejects reserved names", () => {
    assert.equal(normalizeCampaignCode(" @Spring-Launch ", reserved), "spring-launch");
    assert.equal(normalizeCampaignCode("admin", reserved), null);
    assert.equal(normalizeCampaignCode("c", reserved), null);
    assert.equal(normalizeCampaignCode("ab", reserved), null);
    assert.equal(normalizeCampaignCode("spring--launch", reserved), null);
  });

  it("keeps one short-link slot for the profile and the rest for campaigns", () => {
    assert.equal(canAddCampaignLink({ shortlinkMax: 1, campaignCount: 0 }), false);
    assert.equal(canAddCampaignLink({ shortlinkMax: 5, campaignCount: 0 }), true);
    assert.equal(canAddCampaignLink({ shortlinkMax: 5, campaignCount: 3 }), true);
    assert.equal(canAddCampaignLink({ shortlinkMax: 5, campaignCount: 4 }), false);
  });

  it("requires a scheduled start more than a minute ahead and applies only pending rows that are due", () => {
    const now = new Date("2026-10-07T12:00:00.000Z");
    assert.equal(scheduleStartsInFuture(new Date(now.getTime() + 61_000), now), true);
    assert.equal(scheduleStartsInFuture(new Date(now.getTime() + 60_000), now), false);
    assert.equal(scheduleIsDue({ status: "pending", startsAt: now, now }), true);
    assert.equal(scheduleIsDue({ status: "pending", startsAt: new Date(now.getTime() + 1_000), now }), false);
    assert.equal(scheduleIsDue({ status: "applied", startsAt: now, now }), false);
  });
});
