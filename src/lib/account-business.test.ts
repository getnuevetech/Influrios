import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { homePathForRole, registerAccount } from "./accounts";
import { prisma } from "./db";

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

describe("homePathForRole", () => {
  it("routes BUSINESS and AGENCY to the business home, everyone else to the creator dashboard", () => {
    assert.equal(homePathForRole("BUSINESS"), "/business/home");
    assert.equal(homePathForRole("AGENCY"), "/business/home");
    assert.equal(homePathForRole("CREATOR"), "/creator");
    assert.equal(homePathForRole(null), "/creator");
    assert.equal(homePathForRole(undefined), "/creator");
  });
});

describe("registerAccount role support", () => {
  it("creates a new user with role BUSINESS when requested", async (t) => {
    if (!(await requireDb(t))) return;
    const stamp = Date.now().toString(36);
    const email = `biz-signup-${stamp}@example.com`;
    const user = await registerAccount({
      email,
      name: "Jordan Business Contact",
      password: "a-very-long-password",
      source: "business-register-test",
      role: "BUSINESS",
    });
    try {
      assert.equal(user.role, "BUSINESS");
      assert.equal(homePathForRole(user.role), "/business/home");
    } finally {
      await prisma.emailChallenge.deleteMany({ where: { userId: user.id } });
      await prisma.consentRecord.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it("defaults to CREATOR when no role is given", async (t) => {
    if (!(await requireDb(t))) return;
    const stamp = Date.now().toString(36);
    const email = `creator-signup-${stamp}@example.com`;
    const user = await registerAccount({
      email,
      name: "Taylor Creator",
      password: "a-very-long-password",
      source: "register-test",
    });
    try {
      assert.equal(user.role, "CREATOR");
    } finally {
      await prisma.emailChallenge.deleteMany({ where: { userId: user.id } });
      await prisma.consentRecord.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it("never demotes an ADMIN when the same email re-registers unverified", async (t) => {
    if (!(await requireDb(t))) return;
    const stamp = Date.now().toString(36);
    const email = `admin-reregister-${stamp}@example.com`;
    const admin = await prisma.user.create({
      data: { email, name: "Admin User", role: "ADMIN" },
    });
    try {
      const user = await registerAccount({
        email,
        name: "Admin User Retry",
        password: "a-very-long-password",
        source: "business-register-test",
        role: "BUSINESS",
      });
      assert.equal(user.id, admin.id);
      assert.equal(user.role, "ADMIN");
    } finally {
      await prisma.emailChallenge.deleteMany({ where: { userId: admin.id } });
      await prisma.consentRecord.deleteMany({ where: { userId: admin.id } });
      await prisma.user.delete({ where: { id: admin.id } });
    }
  });
});

describe("business signup surfaces", () => {
  it("wires the business marketing signup form to a real registration server action", () => {
    const signupActions = readFileSync("src/app/business/signup-actions.ts", "utf8");
    const form = readFileSync("src/components/business-signup-form.tsx", "utf8");
    const marketing = readFileSync("src/components/business-marketing.tsx", "utf8");

    assert.match(signupActions, /export async function actionRegisterBusiness/);
    assert.match(signupActions, /role:\s*"BUSINESS"/);
    assert.match(signupActions, /ensureOwnedBusinessWorkspace/);
    assert.match(signupActions, /\/account\/verify\?email=/);
    // Account login uses business name + business email; contact person is profile-only.
    assert.match(signupActions, /name:\s*businessName/);
    assert.match(signupActions, /contactName/);
    assert.match(signupActions, /contactEmail/);
    assert.match(signupActions, /contactPhone/);
    assert.equal(/name:\s*contactName/.test(signupActions), false);

    assert.match(form, /actionRegisterBusiness/);
    assert.match(form, /PlaceFields/);
    assert.match(form, /type="submit"/);
    assert.match(form, /Business Email/);
    assert.match(form, /Contact person/);
    assert.match(form, /name="contactPhone"/);
    assert.match(form, /name="contactEmail"/);
    // Required account-creation consent with legal document links.
    assert.match(form, /name="consent"/);
    assert.match(form, /\/legal\/terms-of-service/);
    assert.match(form, /\/legal\/business-terms/);
    assert.match(form, /\/legal\/electronic-consent/);
    assert.match(form, /\/legal\/privacy-policy/);
    assert.match(form, /By creating a business account/);
    // Marketing preference is optional and must not replace legal consent.
    assert.match(form, /name="marketingOptIn"/);
    // Contact block must come after business type / website fields.
    const contactIdx = form.indexOf("Contact person");
    const businessTypeIdx = form.indexOf('name="businessType"');
    assert.ok(businessTypeIdx > 0 && contactIdx > businessTypeIdx);
    assert.match(signupActions, /business_registration/);

    assert.match(marketing, /BusinessSignupForm/);
    // The primary CTA must submit the form, not link out to the generic /register page.
    assert.equal(/href="\/register\?/.test(marketing), false);
  });

  it("gives registerAccount an optional BUSINESS role parameter", () => {
    const accounts = readFileSync("src/lib/accounts.ts", "utf8");
    assert.match(accounts, /role\?:\s*"CREATOR"\s*\|\s*"BUSINESS"/);
  });
});
