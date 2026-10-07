import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nfcUrlRecord, nfcWriteErrorMessage } from "./nfc-writer";

describe("in-app NFC writer", () => {
  it("writes only an https URL record", () => {
    assert.deepEqual(nfcUrlRecord("https://inflr.me/n/abc123"), {
      recordType: "url",
      data: "https://inflr.me/n/abc123",
    });
    assert.equal(nfcUrlRecord("http://inflr.me/n/abc123"), null);
    assert.equal(nfcUrlRecord("not a url"), null);
  });

  it("explains a refused or unsupported write", () => {
    assert.match(nfcWriteErrorMessage("NotAllowedError"), /Allow NFC/);
    assert.match(nfcWriteErrorMessage("NotSupportedError"), /cannot write/);
    assert.match(nfcWriteErrorMessage("AbortError"), /cancelled/);
  });
});
