import assert from "node:assert/strict";
import path from "path";
import { describe, it } from "node:test";
import { isTikTokRootFile, myFileContentType, myfilesDirectory, resolveMyFile } from "./myfiles";

describe("public myfiles", () => {
  it("serves a file dropped in src/app/myfiles", () => {
    const full = resolveMyFile("tik.pdf");
    assert.equal(full, path.join(myfilesDirectory(), "tik.pdf"));
    assert.equal(myFileContentType("tik.pdf"), "application/pdf");
  });

  it("recognizes the TikTok root verification file", () => {
    assert.equal(isTikTokRootFile("tiktokAle3Vw7tiayS6zvSbr2NCyhFWpfRy1AX.txt"), true);
    assert.equal(isTikTokRootFile("tik.pdf"), false);
    assert.equal(isTikTokRootFile("../tiktokAle3Vw7tiayS6zvSbr2NCyhFWpfRy1AX.txt"), false);
  });

  it("rejects paths that leave the folder", () => {
    assert.equal(resolveMyFile("../.env"), null);
    assert.equal(resolveMyFile(".."), null);
    assert.equal(resolveMyFile("nested/tik.pdf"), null);
    assert.equal(resolveMyFile(".env"), null);
    assert.equal(resolveMyFile(""), null);
  });
});
