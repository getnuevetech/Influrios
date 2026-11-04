import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AdminDashboardData } from "./admin-dashboard";

/** Shape guard — keeps the Platform Overview contract stable for the redesign. */
describe("admin dashboard data contract", () => {
  it("exposes the platform overview fields the UI renders", () => {
    const sample: AdminDashboardData = {
      sessionName: "Super Admin",
      sessionEmail: "admin@influrios.com",
      sessionRole: "Super Admin",
      rangeLabel: "Last 30 days",
      kpis: [],
      growth: [],
      growthTotal: 0,
      growthTrend: { pct: null, up: null },
      collabVolume: [],
      collabTotal: 0,
      collabTrend: { pct: null, up: null },
      health: [],
      activity: [],
      categories: [],
      corridors: [],
      upcomingPayoutsCents: 0,
      upcomingPayoutCount: 0,
      pendingInvitations: 0,
      invitationTrend: { pct: null, up: null },
    };
    assert.equal(sample.rangeLabel, "Last 30 days");
    assert.equal(sample.sessionRole, "Super Admin");
    assert.ok(Array.isArray(sample.kpis));
    assert.ok(Array.isArray(sample.health));
  });
});
