import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { corridorFieldsFromSchemaAttempts, schemaAttemptFromResponse } from "./airwallex-corridor";

describe("Airwallex corridor schema mapping", () => {
  it("keeps a local bank method only when the schema response is accepted", () => {
    const accepted = schemaAttemptFromResponse({
      transferMethod: "LOCAL",
      entityType: "PERSONAL",
      currency: "gbp",
      status: 200,
      body: { fields: [{ path: "beneficiary.bank_details.account_number" }], account_currency: "GBP", transfer_method: "LOCAL" },
    });
    const rejected = schemaAttemptFromResponse({
      transferMethod: "SWIFT",
      entityType: "COMPANY",
      currency: "GBP",
      status: 400,
      body: { code: "invalid_argument", message: "unsupported" },
    });
    assert.equal(accepted.accepted, true);
    assert.equal(rejected.accepted, false);
    const fields = corridorFieldsFromSchemaAttempts([accepted, rejected]);
    assert.deepEqual(fields, {
      currency: "GBP",
      payoutMethods: ["local_bank"],
      accountTypes: ["PERSONAL"],
      rawMethods: ["LOCAL"],
    });
  });

  it("writes nothing when every schema call is rejected", () => {
    const rejected = schemaAttemptFromResponse({
      transferMethod: "LOCAL",
      entityType: "PERSONAL",
      currency: "USD",
      status: 200,
      body: { code: "schema_unavailable" },
    });
    assert.equal(rejected.accepted, false);
    assert.equal(corridorFieldsFromSchemaAttempts([rejected]), null);
  });

  it("records a USD bank method only for an accepted SWIFT schema in USD", () => {
    const swift = schemaAttemptFromResponse({
      transferMethod: "SWIFT",
      entityType: "COMPANY",
      currency: "USD",
      status: 200,
      body: { schema: { type: "object" }, account_currency: "USD", transfer_method: "SWIFT" },
    });
    const fields = corridorFieldsFromSchemaAttempts([swift]);
    assert.deepEqual(fields?.payoutMethods, ["usd_bank"]);
    assert.deepEqual(fields?.accountTypes, ["COMPANY"]);
  });
});
