import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { quoteFromWiseRate } from "./fx-share";
import { readWiseUserRate, wiseQuoteUrl } from "./wise-fx";

describe("Wise user rate", () => {
  it("builds a quote URL only for Wise hosts", () => {
    assert.equal(
      wiseQuoteUrl({ baseUrl: "https://api.wise.com", apiVersion: "v3", profileId: "101" }),
      "https://api.wise.com/v3/profiles/101/quotes",
    );
    assert.equal(
      wiseQuoteUrl({ baseUrl: "https://api.transferwise.com/", apiVersion: "v3", profileId: "101" }),
      "https://api.transferwise.com/v3/profiles/101/quotes",
    );
    assert.equal(wiseQuoteUrl({ baseUrl: "https://evil.example", apiVersion: "v3", profileId: "101" }), null);
    assert.equal(wiseQuoteUrl({ baseUrl: "http://api.wise.com", apiVersion: "v3", profileId: "101" }), null);
    assert.equal(wiseQuoteUrl({ baseUrl: "https://api.wise.com", apiVersion: "../v3", profileId: "101" }), null);
    assert.equal(wiseQuoteUrl({ baseUrl: "https://api.wise.com", apiVersion: "v3", profileId: "" }), null);
  });

  it("reads the quote rate and ignores a mismatched currency", () => {
    const parsed = readWiseUserRate(
      {
        id: "quote-1",
        sourceCurrency: "USD",
        targetCurrency: "GBP",
        rate: 0.75,
        rateType: "FIXED",
        createdTime: "2026-09-30T12:00:00Z",
      },
      { sourceCurrency: "USD", targetCurrency: "GBP" },
    );
    assert.equal(parsed?.rate, 0.75);
    assert.equal(parsed?.quoteId, "quote-1");
    assert.equal(
      readWiseUserRate(
        { sourceCurrency: "USD", targetCurrency: "EUR", rate: 0.9 },
        { sourceCurrency: "USD", targetCurrency: "GBP" },
      ),
      null,
    );
    assert.equal(readWiseUserRate({ sourceCurrency: "USD", targetCurrency: "GBP", rate: 0 }, { sourceCurrency: "USD", targetCurrency: "GBP" }), null);
  });

  it("converts 100.00 USD at 0.75 into 75.00 GBP", () => {
    const quoted = quoteFromWiseRate({ usdCents: 10_000, currency: "GBP", rate: 0.75, minorDigits: 2 });
    assert.equal(quoted.ok, true);
    if (quoted.ok) {
      assert.equal(quoted.convertedMinor, 7_500);
      assert.equal(quoted.minorPerUsd, 75);
      assert.equal(quoted.source, "wise");
    }
    assert.equal(quoteFromWiseRate({ usdCents: 10_000, currency: "GBP", rate: 0, minorDigits: 2 }).ok, false);
  });
});
