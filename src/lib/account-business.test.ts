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

    assert.match(form, /actionRegisterBusiness/);
    assert.match(form, /PlaceFields/);
    assert.match(form, /type="submit"/);

    assert.match(marketing, /BusinessSignupForm/);
    // The primary CTA must submit the form, not link out to the generic /register page.
    assert.equal(/href="\/register\?/.test(marketing), false);
  });

  it("gives registerAccount an optional BUSINESS role parameter", () => {
    const accounts = readFileSync("src/lib/accounts.ts", "utf8");
    assert.match(accounts, /role\?:\s*"CREATOR"\s*\|\s*"BUSINESS"/);
  });
});
