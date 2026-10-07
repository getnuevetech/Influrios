import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prisma } from "./db";
import {
  applyIntroFeeFromWebhook,
  confirmIntroFeeSettlement,
  createIntro,
  requestIntroFeeSettlement,
} from "./managed-matching";
import {
  assertIntroNotProtectedPayment,
  introStatusDisplayLabel,
  matchingStageImpliesProtectedPayment,
} from "./matching-product-boundary";

describe("intro fee settlement (W4 / R073)", () => {
  it("quotes a managed_intro fee, confirms sandbox settlement, and never implies Fully Funded", async () => {
    const intro = await createIntro({
      businessName: "Harbor Co",
      creatorSlug: "sofia-martinez",
      briefTitle: "W4 intro fee settlement",
      feeExpected: "managed intro fee",
    });
    try {
      const quoted = await requestIntroFeeSettlement(intro.id, { grossValueCents: 10_000 });
      assert.equal(quoted.ok, true);
      if (!quoted.ok) return;
      assert.ok(quoted.feeCents > 0);
      assert.match(quoted.intentRef, /^intro_fee_/);
      assert.equal(quoted.quote.feeType, "managed_intro");

      const stored = await prisma.managedIntro.findUnique({ where: { id: intro.id } });
      assert.equal(stored?.feeExpectedCents, quoted.feeCents);
      assert.equal(stored?.feeIntentRef, quoted.intentRef);
      assert.notEqual(stored?.status, "paid");

      const blocked = await confirmIntroFeeSettlement(intro.id, "");
      assert.equal(blocked.ok, false);

      const typed = await confirmIntroFeeSettlement(intro.id, `sandbox_${quoted.intentRef}`);
      assert.equal(typed.ok, false);
      if (!typed.ok) assert.match(typed.error, /webhook/i);
      const unpaid = await prisma.managedIntro.findUnique({ where: { id: intro.id } });
      assert.notEqual(unpaid?.status, "paid");
      assert.equal(unpaid?.feeProviderRef, null);

      const confirmed = await applyIntroFeeFromWebhook({
        intentRef: quoted.intentRef,
        paymentId: "int_intro_1",
        eventId: "evt_intro_1",
      });
      assert.equal(confirmed.ok, true);
      if (!confirmed.ok) return;
      assert.equal(confirmed.duplicate, false);

      const settled = await prisma.managedIntro.findUnique({ where: { id: intro.id } });
      assert.equal(settled?.status, "paid");
      assert.equal(settled?.feeProviderRef, "int_intro_1");
      assert.ok(settled?.feeSettlementAt);

      assert.equal(introStatusDisplayLabel("paid"), "Intro fee settled");
      assert.equal(matchingStageImpliesProtectedPayment({ introStatus: "paid" }), false);
      assert.equal(assertIntroNotProtectedPayment({ claimingFullyFunded: true }).ok, false);
      assert.equal(assertIntroNotProtectedPayment({}).ok, true);

      const again = await applyIntroFeeFromWebhook({
        intentRef: quoted.intentRef,
        paymentId: "int_intro_1",
        eventId: "evt_intro_1",
      });
      assert.equal(again.ok, true);
      if (again.ok) assert.equal(again.duplicate, true);
      const other = await applyIntroFeeFromWebhook({
        intentRef: quoted.intentRef,
        paymentId: "int_intro_2",
        eventId: "evt_intro_2",
      });
      assert.equal(other.ok, false);
    } finally {
      await prisma.managedIntroEvent.deleteMany({ where: { introId: intro.id } });
      await prisma.managedIntro.deleteMany({ where: { id: intro.id } });
    }
  });

  it("refuses confirm before a quote and refuses quote on declined intros", async () => {
    const intro = await createIntro({
      businessName: "Northwind",
      creatorSlug: "sofia-martinez",
      briefTitle: "W4 intro fee gates",
    });
    try {
      const early = await confirmIntroFeeSettlement(intro.id, "sandbox_x");
      assert.equal(early.ok, false);
      if (!early.ok) assert.match(early.error, /quote/i);

      await prisma.managedIntro.update({ where: { id: intro.id }, data: { status: "declined" } });
      const quoted = await requestIntroFeeSettlement(intro.id);
      assert.equal(quoted.ok, false);
      if (!quoted.ok) assert.match(quoted.error, /closed/i);
    } finally {
      await prisma.managedIntroEvent.deleteMany({ where: { introId: intro.id } });
      await prisma.managedIntro.deleteMany({ where: { id: intro.id } });
    }
  });
});
