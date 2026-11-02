import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { encodeSession, type AdminSession } from "./admin-auth";
import {
  adminSessionCookieLooksValid,
  edgeAdminSessionSecret,
} from "./admin-session-edge";

function nodeSign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

describe("admin session edge cookie verify", () => {
  it("resolves the same secret fallback as Node admin signing in non-production", () => {
    assert.equal(
      edgeAdminSessionSecret({ NODE_ENV: "test" }),
      "influrios-dev-admin-secret-change-me",
    );
    assert.equal(
      edgeAdminSessionSecret({ NODE_ENV: "production", AUTH_SECRET: "live-secret" }),
      "live-secret",
    );
    assert.equal(edgeAdminSessionSecret({ NODE_ENV: "production" }), null);
  });

  it("accepts cookies signed by Node encodeSession and rejects junk", async () => {
    const secret = edgeAdminSessionSecret({ NODE_ENV: "test" })!;
    const prevAuth = process.env.AUTH_SECRET;
    const prevAdmin = process.env.ADMIN_SESSION_SECRET;
    const prevNode = process.env.NODE_ENV;
    process.env.AUTH_SECRET = secret;
    process.env.ADMIN_SESSION_SECRET = "";
    process.env.NODE_ENV = "test";
    try {
      const session: AdminSession = {
        userId: "user_super",
        email: "admin@influrios.com",
        name: "Super",
        roleId: "role_super",
        roleName: "Super Admin",
        permissions: ["banners.view"],
        permissionVersion: 1,
        exp: Date.now() + 60_000,
      };
      const token = encodeSession(session);
      assert.equal(await adminSessionCookieLooksValid(token, secret), true);
      assert.equal(await adminSessionCookieLooksValid(token, "wrong-secret"), false);
      assert.equal(await adminSessionCookieLooksValid("not-a-token", secret), false);
      assert.equal(await adminSessionCookieLooksValid("", secret), false);

      const [payload] = token.split(".");
      const bad = `${payload}.${nodeSign(payload!, "other")}`;
      assert.equal(await adminSessionCookieLooksValid(bad, secret), false);

      const expired: AdminSession = { ...session, exp: Date.now() - 1_000 };
      assert.equal(await adminSessionCookieLooksValid(encodeSession(expired), secret), false);
    } finally {
      if (prevAuth === undefined) delete process.env.AUTH_SECRET;
      else process.env.AUTH_SECRET = prevAuth;
      if (prevAdmin === undefined) delete process.env.ADMIN_SESSION_SECRET;
      else process.env.ADMIN_SESSION_SECRET = prevAdmin;
      if (prevNode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNode;
    }
  });
});
