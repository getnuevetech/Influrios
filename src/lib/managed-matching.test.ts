import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { prisma } from "./db";
import {
  applyIntroFeeFromWebhook,
  confirmIntroFeeSettlement,
  createIntro,
  introFeeQuoteCurrency,
  introFeeQuoteInput,
  requestIntroFeeSettlement,
} from "./managed-matching";
import {
  assertIntroNotProtectedPayment,
  introStatusDisplayLabel,
  matchingStageImpliesProtectedPayment,
} from "./matching-product-boundary";

const hasDbUrl = Boolean(process.env.DATABASE_URL);

async function requireDb(t: { skip: (msg?: string) => void }) {
  if (!hasDbUrl) {
    t.skip("DATABASE_URL not set");
    return false;
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    t.skip("Postgres not reachable");
    return false;
  }
}

describe("intro fee quote input", () => {
  it("keeps the entered jurisdiction and gross", () => {
    const draft = introFeeQuoteInput({ jurisdiction: "ng", grossValueCents: 2500 });
    assert.equal(draft.ok, true);
    if (!draft.ok) return;
    assert.equal(draft.jurisdiction, "NG");
    assert.equal(draft.grossValueCents, 2500);
    assert.equal(introFeeQuoteCurrency({ currency: "gbp" }), "GBP");
    assert.equal(introFeeQuoteCurrency({ currency: "" }), "");
    assert.equal(introFeeQuoteCurrency(null), "");
  });

  it("does not invent a jurisdiction, a gross, or a currency", () => {
    const blank = introFeeQuoteInput({});
    assert.equal(blank.ok, false);
    if (!blank.ok) assert.match(blank.error, /jurisdiction/i);

    const noGross = introFeeQuoteInput({ jurisdiction: "GB" });
    assert.equal(noGross.ok, false);
    if (!noGross.ok) assert.match(noGross.error, /gross/i);

    const zero = introFeeQuoteInput({ jurisdiction: "GB", grossValueCents: 0 });
    assert.equal(zero.ok, false);
    const fraction = introFeeQuoteInput({ jurisdiction: "GB", grossValueCents: 10.5 });
    assert.equal(fraction.ok, false);

    const source = readFileSync("src/lib/managed-matching.ts", "utf8");
    const action = readFileSync("src/app/admin/matching/actions.ts", "utf8");
    const page = readFileSync("src/app/admin/matching/page.tsx", "utf8");
    const checkout = readFileSync("src/lib/providers/airwallex-runtime.ts", "utf8");
    assert.equal(source.includes('|| "US"'), false);
    assert.equal(source.includes("DEFAULT_INTRO_FEE_GROSS_CENTS"), false);
    assert.equal(source.includes("10_000"), false);
    assert.equal(action.includes('|| "US"'), false);
    assert.match(action, /jurisdiction/);
    assert.match(page, /name="jurisdiction"/);
    assert.equal(page.includes('placeholder="10000"'), false);
    assert.equal(checkout.includes('currency: "USD"'), false);
  });
});

describe("intro fee settlement (W4 / R073)", () => {
  it("quotes a managed_intro fee, confirms sandbox settlement, and never implies Fully Funded", async (t) => {
    if (!(await requireDb(t))) return;
    const intro = await createIntro({
      businessName: "Harbor Co",
      creatorSlug: "sofia-martinez",
      briefTitle: "W4 intro fee settlement",
      feeExpected: "managed intro fee",
    });
    try {
      const quoted = await requestIntroFeeSettlement(intro.id, {
        jurisdiction: "US",
        grossValueCents: 10_000,
      });
      assert.equal(quoted.ok, true);
      if (!quoted.ok) return;
      assert.ok(quoted.feeCents > 0);
      assert.match(quoted.intentRef, /^intro_fee_/);
      assert.equal(quoted.quote.feeType, "managed_intro");

      const stored = await prisma.managedIntro.findUnique({ where: { id: intro.id } });
      assert.equal(stored?.feeExpectedCents, quoted.feeCents);
      assert.equal(stored?.feeIntentRef, quoted.intentRef);
      const snapshot = stored?.feeQuoteJson as {
        jurisdiction?: string;
        grossValueCents?: number;
        currency?: string;
      } | null;
      assert.equal(snapshot?.jurisdiction, "US");
      assert.equal(snapshot?.grossValueCents, 10_000);
      const jurisdiction = await prisma.collaborationJurisdiction.findUnique({ where: { code: "US" } });
      assert.equal(snapshot?.currency, introFeeQuoteCurrency({ currency: jurisdiction?.currency ?? "" }));
      assert.notEqual(snapshot?.currency, "");
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

  it("refuses confirm before a quote and refuses quote on declined intros", async (t) => {
    if (!(await requireDb(t))) return;
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
