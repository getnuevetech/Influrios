import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prisma } from "./db";
import { setStripeTransportForTests } from "./stripe-admin";
import { connectStatusFromAccount, refreshCreatorConnectStatus, requirementLabels } from "./stripe-connect-status";

describe("Stripe Connect status", () => {
  it("mirrors what Stripe reports", () => {
    assert.equal(connectStatusFromAccount({ payouts_enabled: true, details_submitted: true, requirements: { currently_due: [] } }).status, "VERIFIED");
    assert.equal(
      connectStatusFromAccount({ payouts_enabled: true, details_submitted: true, requirements: { currently_due: ["individual.verification.document"] } }).status,
      "PENDING",
    );
    assert.equal(connectStatusFromAccount({ payouts_enabled: false, details_submitted: true, requirements: {} }).status, "PENDING");
    assert.equal(connectStatusFromAccount({ payouts_enabled: false, details_submitted: false }).status, "UNVERIFIED");
    assert.equal(connectStatusFromAccount({ payouts_enabled: false, requirements: { disabled_reason: "rejected.fraud" } }).status, "REJECTED");
  });

  it("names what Stripe still needs in plain words", () => {
    assert.deepEqual(requirementLabels(["external_account", "individual.ssn_last_4", "individual.dob.day", "individual.dob.month", "tos_acceptance.date"]), [
      "Bank account for payouts",
      "Social Security number",
      "Date of birth",
      "Accept Stripe's terms",
    ]);
  });

  it("marks the influencer payout-ready and records gateway KYC once when Stripe verifies them", async (t) => {
    if (!process.env.DATABASE_URL) return t.skip("no database");
    const stamp = Date.now().toString(36);
    const previousKey = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = "sk_test_connectstatus";
    let enabled = false;
    setStripeTransportForTests(async () =>
      new Response(
        JSON.stringify({
          id: "acct_kyc",
          payouts_enabled: enabled,
          details_submitted: true,
          requirements: { currently_due: enabled ? [] : ["external_account"] },
        }),
        { status: 200 },
      ),
    );
    const country = "ZW";
    await prisma.countryActivationCorridor.upsert({
      where: { countryCode: country },
      update: { kycModel: "gateway" },
      create: { countryCode: country, active: true, currency: "USD", payoutMethodsJson: ["local_bank"], kycModel: "gateway", notes: "" },
    });
    const creator = await prisma.creator.create({ data: { slug: `kyc-${stamp}`, displayName: "KYC Test", locationCountry: "Zimbabwe" } as never });
    await prisma.influencerPayoutProfile.create({ data: { creatorId: creator.id, stripeConnectAccountId: "acct_kycTest" } as never });
    try {
      const pending = await refreshCreatorConnectStatus(creator.id);
      assert.equal(pending.ok && pending.status, "PENDING");
      assert.equal((await prisma.creatorKycSubmission.findUnique({ where: { creatorSlug: creator.slug } }))?.status ?? "none", "none");

      enabled = true;
      const verified = await refreshCreatorConnectStatus(creator.id);
      assert.equal(verified.ok && verified.status, "VERIFIED");
      const profile = await prisma.influencerPayoutProfile.findUnique({ where: { creatorId: creator.id } });
      assert.equal(profile?.primaryStatus, "VERIFIED");
      const kyc = await prisma.creatorKycSubmission.findUnique({ where: { creatorSlug: creator.slug } });
      assert.equal(kyc?.status, "verified");
      assert.equal(kyc?.kycModel, "gateway");

      // A later Stripe change affects payouts, never the completed KYC.
      enabled = false;
      await refreshCreatorConnectStatus(creator.id);
      assert.equal((await prisma.creatorKycSubmission.findUnique({ where: { creatorSlug: creator.slug } }))?.status, "verified");
    } finally {
      setStripeTransportForTests(null);
      if (previousKey === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = previousKey;
      await prisma.creatorKycSubmission.deleteMany({ where: { creatorSlug: creator.slug } });
      await prisma.creator.delete({ where: { id: creator.id } }).catch(() => undefined);
      await prisma.countryActivationCorridor.delete({ where: { countryCode: country } }).catch(() => undefined);
    }
  });
});
