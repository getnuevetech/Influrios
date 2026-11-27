import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { base32Decode, base32Encode, matchTotp, mfaStepFor, newTotpSecret, otpauthUrl, readAdminMfaMode, totpAt } from "@/lib/admin-mfa";

describe("admin sign-in code", () => {
  it("matches the RFC 6238 SHA-1 test vectors (6 digits)", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    assert.equal(totpAt(secret, Math.floor(59 / 30)), "287082");
    assert.equal(totpAt(secret, Math.floor(1111111109 / 30)), "081804");
    assert.equal(totpAt(secret, Math.floor(1234567890 / 30)), "005924");
  });

  it("round-trips base32 and makes 32-character secrets", () => {
    const buf = Buffer.from("hello authenticator");
    assert.deepEqual(base32Decode(base32Encode(buf)), buf);
    assert.equal(newTotpSecret().length, 32);
  });

  it("accepts the current code once, allows one step of drift, refuses replay", () => {
    const secret = newTotpSecret();
    const now = 1_800_000_000_000;
    const step = Math.floor(now / 1000 / 30);
    assert.equal(matchTotp(secret, totpAt(secret, step), null, now), step);
    assert.equal(matchTotp(secret, totpAt(secret, step - 1), null, now), step - 1);
    assert.equal(matchTotp(secret, totpAt(secret, step), step, now), null);
    assert.equal(matchTotp(secret, totpAt(secret, step - 3), null, now), null);
    assert.equal(matchTotp(secret, "12345", null, now), null);
  });

  it("asks for a code only as the mode says", () => {
    assert.equal(readAdminMfaMode(null), "off");
    assert.equal(mfaStepFor("off", true), "none");
    assert.equal(mfaStepFor("enrolled", true), "verify");
    assert.equal(mfaStepFor("enrolled", false), "none");
    assert.equal(mfaStepFor("required", false), "enroll");
    assert.equal(mfaStepFor("required", true), "verify");
  });

  it("builds an authenticator link", () => {
    assert.match(otpauthUrl("ABC", "a@b.co"), /^otpauth:\/\/totp\/Influrios%20Admin%3Aa%40b\.co\?secret=ABC&issuer=Influrios%20Admin/);
  });
});
