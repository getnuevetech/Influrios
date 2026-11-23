import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sniffImageType } from "./profile-uploads";
import { allowMediaUpload } from "./upload-limits";

describe("profile image uploads", () => {
  it("reads the real type from the first bytes", () => {
    assert.equal(sniffImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
    assert.equal(sniffImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
    assert.equal(sniffImageType(new TextEncoder().encode("GIF89a....")), "image/gif");
    assert.equal(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ")), "image/webp");
    assert.equal(sniffImageType(new TextEncoder().encode("<html><script>")), null);
  });

  it("caps uploads per draft and per address", () => {
    const now = 1_000_000;
    for (let i = 0; i < 20; i += 1) assert.equal(allowMediaUpload(["draft:t1", "ip:t1"], now), true);
    assert.equal(allowMediaUpload(["draft:t1", "ip:t2"], now), false);
    assert.equal(allowMediaUpload(["draft:t2", "ip:t1"], now), false);
    assert.equal(allowMediaUpload(["draft:t1", "ip:t1"], now + 16 * 60_000), true);
  });
});
