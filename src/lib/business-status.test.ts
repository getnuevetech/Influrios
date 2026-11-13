import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  activeCollaborationIds,
  activeRequestIds,
  businessTrustLabels,
  formatPeriodFunding,
  occupiedSeatCount,
  presentBusinessVerification,
  profileIsComplete,
  selectedMonthWindow,
  summarizeMonthlyFunding,
} from "./business-status";

describe("business verification badge", () => {
  it("does not treat a completed profile as verified", () => {
    assert.equal(profileIsComplete({ name: "ABC Holdings", industry: "Retail", contactName: "Ada" }), true);
    assert.equal(presentBusinessVerification([]), "unverified");
    const labels = businessTrustLabels({
      profileComplete: true,
      verification: presentBusinessVerification([{ role: "paying_business", checkKey: "email", status: "verified" }]),
    });
    assert.equal(labels.profile, "Profile complete");
    assert.equal(labels.showVerifiedBadge, false);
    assert.equal(labels.verification, "Business verification not started");
    assert.equal(
      presentBusinessVerification([
        { role: "paying_business", checkKey: "entity", status: "verified" },
        { role: "paying_business", checkKey: "authority", status: "verified" },
      ]),
      "verified",
    );
    assert.equal(
      presentBusinessVerification([
        { role: "paying_business", checkKey: "entity", status: "verified" },
        { role: "paying_business", checkKey: "authority", status: "in_review" },
      ]),
      "pending",
    );
    assert.equal(
      presentBusinessVerification([{ role: "paying_business", checkKey: "entity", status: "restricted" }]),
      "rejected",
    );
    assert.equal(
      presentBusinessVerification([{ role: "paying_business", checkKey: "authority", status: "expired" }]),
      "expired",
    );
    const home = readFileSync("src/app/business/home/page.tsx", "utf8");
    assert.equal(home.includes("verifiedBusiness"), false);
    assert.equal(home.includes("Math.min(1, teamSeats)"), false);
    assert.equal(home.includes("Monthly Spend"), false);
  });
});

describe("seats and request counters", () => {
  it("counts the owner and accepted seats, and requests without collaborations", () => {
    assert.equal(occupiedSeatCount({ ownerPresent: true, seats: [] }), 1);
    assert.equal(
      occupiedSeatCount({
        ownerPresent: true,
        seats: [
          { inviteStatus: "accepted", active: true },
          { inviteStatus: "pending", active: true },
          { inviteStatus: "accepted", active: false },
        ],
      }),
      2,
    );
    const ids = activeRequestIds({
      briefs: [
        { id: "brief-1", status: "active" },
        { id: "brief-2", status: "draft" },
      ],
      requests: [
        { id: "request-1", briefId: "brief-1", status: "published" },
        { id: "request-2", briefId: null, status: "published" },
        { id: "request-3", briefId: "brief-9", status: "closed" },
      ],
    });
    assert.deepEqual(ids, ["brief:brief-1", "request:request-2"]);
    assert.deepEqual(
      activeCollaborationIds([
        { id: "funding-1", stage: "Funded" },
        { id: "funding-1", stage: "Funded" },
        { id: "funding-2", stage: "Released" },
      ]),
      ["funding-1"],
    );
  });
});

describe("monthly funding", () => {
  it("uses the selected month and keeps currencies apart", () => {
    const before = new Date("2026-03-01T05:30:00.000Z");
    const boundary = new Date("2026-03-01T06:00:00.000Z");
    const february = selectedMonthWindow(before);
    const march = selectedMonthWindow(boundary);
    assert.equal(february.month, 2);
    assert.equal(march.month, 3);
    assert.ok(before < march.start);
    assert.ok(boundary >= march.start);
    const rows = summarizeMonthlyFunding(
      [
        {
          id: "old",
          currency: "USD",
          entries: [{ kind: "hold", amountCents: 50_000, party: "", createdAt: before }],
        },
        {
          id: "current",
          currency: "usd",
          entries: [
            { kind: "hold", amountCents: 3_750, party: "business", createdAt: boundary },
            { kind: "release", amountCents: 1_000, party: "Influencer", createdAt: boundary },
            { kind: "refund", amountCents: 250, party: "", createdAt: boundary },
          ],
        },
        {
          id: "other",
          currency: "EUR",
          entries: [{ kind: "hold", amountCents: 800, party: "", createdAt: boundary }],
        },
      ],
      march,
    );
    assert.equal(rows.find((row) => row.currency === "USD")?.fundedCents, 3_750);
    assert.equal(rows.find((row) => row.currency === "USD")?.releasedCents, 1_000);
    assert.equal(rows.find((row) => row.currency === "USD")?.refundedCents, 250);
    assert.equal(rows.find((row) => row.currency === "EUR")?.fundedCents, 800);
    const label = formatPeriodFunding(rows);
    assert.equal(label.value.includes("37.5") || label.value.includes("3,750") || label.value.includes("38"), true);
    assert.equal(label.value.includes("+"), false);
    const februaryOnly = summarizeMonthlyFunding(
      [
        {
          id: "old",
          currency: "USD",
          entries: [{ kind: "hold", amountCents: 50_000, party: "", createdAt: before }],
        },
      ],
      march,
    );
    assert.deepEqual(februaryOnly, []);
    assert.equal(formatPeriodFunding([]).note, "No confirmed funding this month.");
  });
});
