import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { collabEmailPath, maskedStripeDestination } from "@/lib/collab-email-links";
import { catalogTemplateForCollab } from "@/lib/email-live";

const APP = path.join(process.cwd(), "src/app");

/** True when a page.tsx serves this path (dynamic [segments] match any value). */
function routeExists(urlPath: string) {
  const segments = urlPath.split("?")[0]!.split("/").filter(Boolean);
  let dirs = [APP];
  for (const segment of segments) {
    const next: string[] = [];
    for (const dir of dirs) {
      if (existsSync(path.join(dir, segment))) next.push(path.join(dir, segment));
      for (const entry of readdirSync(dir)) {
        if (/^\[.+\]$/.test(entry) && statSync(path.join(dir, entry)).isDirectory()) next.push(path.join(dir, entry));
      }
    }
    dirs = next;
  }
  return dirs.some((dir) => existsSync(path.join(dir, "page.tsx")));
}

const catalog = JSON.parse(readFileSync(path.join(process.cwd(), "src/data/email-catalog.json"), "utf8")) as { templates: { id: string }[] };
const COLLAB_KINDS = [
  "funding_required", "funding_successful", "funding_failed", "milestone_submitted", "review_deadline_approaching",
  "revision_requested", "milestone_approved", "milestone_auto_approved", "payout_completed", "payout_failed",
  "payout_requested", "payout_retry", "payout_returned", "dispute_opened", "dispute_resolved", "collaboration_cancelled",
  "refund_completed", "payment_risk", "change_order_accepted", "preexisting_relationship_claimed",
  "provider_jurisdiction_limitation", "dispute_sla_reminder", "provider_hold_period_warning", "stale_funding", "ledger_mismatch",
];

describe("collaboration email links", () => {
  it("send each collaboration email to a page that exists, never the bare payments list", () => {
    const ids = new Set<string>();
    for (const kind of COLLAB_KINDS) {
      for (const role of ["business", "influencer", "admin"] as const) {
        const id = catalogTemplateForCollab(kind, role);
        if (id) ids.add(id);
      }
    }
    assert.ok(ids.size > 30);
    for (const id of ids) {
      assert.ok(catalog.templates.some((row) => row.id === id), `${id} is in the catalog`);
      const target = collabEmailPath(id, { fundingId: "fund_1", milestoneId: "ms_1" });
      assert.notEqual(target, "/payments", `${id} links to a specific page`);
      assert.ok(routeExists(target), `${id} → ${target} is a real page`);
    }
  });

  it("opens the payout receipt from payout emails", () => {
    assert.equal(collabEmailPath("payout.confirmed", { fundingId: "f", milestoneId: "m1" }), "/creator/earnings/receipts/m1");
    assert.equal(collabEmailPath("payout.requested", { fundingId: "f" }), "/creator/earnings");
    assert.equal(collabEmailPath("funding.required", { fundingId: "f" }), "/payments/checkout/f");
    assert.equal(collabEmailPath("milestone.approved", { fundingId: "f", milestoneId: "m1" }), "/collaboration/work/f?tab=milestones&focus=m1");
    assert.equal(collabEmailPath("payout.failed_admin", { fundingId: "f" }), "/admin/deals/f");
    assert.equal(collabEmailPath("payout.confirmed_business", { fundingId: "f" }), "/payments?deal=f");
  });

  it("masks the payout destination", () => {
    assert.equal(maskedStripeDestination("acct_1ABCDEFwxyz"), "Stripe payout account ••••wxyz");
    assert.equal(maskedStripeDestination(""), "");
  });
});

describe("collaboration email figures", () => {
  it("shows the milestone's own gross, fee and net payout, not the whole deal", async (t) => {
    if (!process.env.DATABASE_URL) return t.skip("no database");
    const { prisma } = await import("@/lib/db");
    const { collabMoneyVars, milestonePayoutFacts } = await import("@/lib/collab-email-links");
    const stamp = Date.now().toString(36);
    const creator = await prisma.creator.create({ data: { slug: `mail-${stamp}`, displayName: "Mail Test" } as never });
    await prisma.influencerPayoutProfile.create({ data: { creatorId: creator.id, stripeConnectAccountId: "acct_mailtest1234" } as never });
    const funding = await prisma.collaborationFunding.create({
      data: {
        jurisdictionCode: "US",
        businessName: "Mail Co",
        creatorSlug: creator.slug,
        title: "Mail deal",
        grossCents: 100_000,
        feeCents: 20_000,
        feeSnapshotJson: {},
        serviceLevel: "contracted",
        providerCode: "stripe",
        status: "held",
        milestones: { create: [{ title: "Draft", amountCents: 32_000, sortOrder: 0, status: "released", reviewWindowHours: 72 }] },
      },
      include: { milestones: true },
    });
    const milestone = funding.milestones[0]!;
    try {
      await prisma.collaborationFunding.update({
        where: { id: funding.id },
        data: {
          feeSnapshotJson: {
            financialPlan: {
              signedQuote: {
                milestoneAllocations: [{ milestoneId: milestone.id, grossCents: 40_000, businessCollaborationFeeCents: 4_000, influencerFeeCents: 4_000 }],
              },
            },
          },
        },
      });
      await prisma.ledgerEntry.create({
        data: { fundingId: funding.id, milestoneId: milestone.id, kind: "release", amountCents: 36_000, party: "influencer", accountPurpose: "COLLABORATIONS", provider: "stripe", eventId: `tr_${stamp}` },
      });
      const facts = await milestonePayoutFacts(milestone.id);
      assert.equal(facts?.grossCents, 40_000);
      assert.equal(facts?.netCents, 36_000);
      assert.equal(facts?.transferRef, `tr_${stamp}`);
      const vars = await collabMoneyVars({ fundingId: funding.id, milestoneId: milestone.id });
      assert.equal(vars.milestone_gross, "$400.00");
      assert.equal(vars.milestone_influencer_fee, "$40.00");
      assert.equal(vars.payout_net, "$360.00");
      assert.equal(vars.masked_destination, "Stripe payout account ••••1234");
      assert.equal(vars.milestone_id, milestone.id);
    } finally {
      await prisma.collaborationFunding.delete({ where: { id: funding.id } }).catch(() => undefined);
      await prisma.creator.delete({ where: { id: creator.id } }).catch(() => undefined);
    }
  });
});
