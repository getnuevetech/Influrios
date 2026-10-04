import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADMIN_PERMISSIONS,
  canAccessModule,
  cookieIsSecure,
  decodeSession,
  encodeSession,
  hasPermission,
  type AdminSession,
} from "./admin-auth";

function sampleSession(overrides: Partial<AdminSession> = {}): AdminSession {
  return {
    userId: "user_super",
    email: "admin@influrios.com",
    name: "Super Admin",
    roleId: "role_super",
    roleName: "Super Admin",
    permissions: [...ADMIN_PERMISSIONS],
    exp: Date.now() + 60_000,
    ...overrides,
  };
}

describe("admin session cookie", () => {
  it("round-trips a signed session without changing the cookie payload shape", () => {
    const session = sampleSession({ permissions: ["banners.view", "access.manage_users"] });
    const token = encodeSession(session);
    const decoded = decodeSession(token);
    assert.ok(decoded);
    assert.equal(decoded.userId, session.userId);
    assert.equal(decoded.email, session.email);
    assert.deepEqual(decoded.permissions, ["banners.view", "access.manage_users"]);
  });

  it("expands legacy coarse permission keys on decode", () => {
    const session = sampleSession({
      permissions: ["banners", "access"] as unknown as AdminSession["permissions"],
    });
    const decoded = decodeSession(encodeSession(session));
    assert.ok(decoded);
    assert.ok(decoded.permissions.includes("banners.view"));
    assert.ok(decoded.permissions.includes("banners.edit"));
    assert.ok(decoded.permissions.includes("access.manage_roles"));
    assert.ok(decoded.permissions.includes("access.manage_users"));
  });

  it("rejects a tampered signature", () => {
    const token = encodeSession(sampleSession());
    const [payload] = token.split(".");
    assert.equal(decodeSession(`${payload}.not-a-real-signature`), null);
  });
});

describe("admin permission checks", () => {
  it("gates modules from the permission prefix", () => {
    const session = sampleSession({ permissions: ["marketplace.view"] });
    assert.equal(hasPermission(session, "marketplace.view"), true);
    assert.equal(hasPermission(session, "marketplace.manage"), false);
    assert.equal(canAccessModule(session, "marketplace"), true);
    assert.equal(canAccessModule(session, "billing"), false);
  });

  it("keeps Secure cookies off for plain HTTP forwarded proto", () => {
    assert.equal(cookieIsSecure("http"), false);
    assert.equal(cookieIsSecure("https"), true);
    assert.equal(cookieIsSecure("https, http"), true);
  });
});

describe("admin permission catalog", () => {
  it("includes marketplace, access, and collab finance keys", () => {
    assert.ok(ADMIN_PERMISSIONS.includes("marketplace.manage"));
    assert.ok(ADMIN_PERMISSIONS.includes("access.manage_users"));
    assert.ok(ADMIN_PERMISSIONS.includes("collab_finance.view"));
    assert.ok(ADMIN_PERMISSIONS.includes("collab_finance.manage"));
    assert.ok(ADMIN_PERMISSIONS.includes("collab_finance.high_risk"));
    assert.ok(ADMIN_PERMISSIONS.includes("legacy_demo_payments" as never) === false);
  });

  it("gates collab finance module and high-risk separately", () => {
    const viewer = sampleSession({ permissions: ["collab_finance.view"] });
    assert.equal(canAccessModule(viewer, "collab_finance"), true);
    assert.equal(hasPermission(viewer, "collab_finance.high_risk"), false);
    const risk = sampleSession({ permissions: ["collab_finance.high_risk"] });
    assert.equal(hasPermission(risk, "collab_finance.high_risk"), true);
  });
});
