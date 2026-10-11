import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { kycRequirementKind, missingDocumentKyc } from "./kyc-document";

const requirements = [
  { id: "dob", kind: "detail" as const, label: "Date of birth", required: true },
  { id: "passport", kind: "document" as const, label: "Passport", required: true },
  { id: "note", kind: "detail" as const, label: "Notes", required: false },
];

describe("document KYC requirements", () => {
  it("accepts a detail or a document", () => {
    assert.equal(kycRequirementKind("detail"), "detail");
    assert.equal(kycRequirementKind("document"), "document");
    assert.equal(kycRequirementKind("identity_light"), null);
  });

  it("asks for each required detail and document", () => {
    assert.equal(
      missingDocumentKyc({ requirements, details: {}, hasFile: () => false }),
      "Enter Date of birth.",
    );
    assert.equal(
      missingDocumentKyc({
        requirements,
        details: { dob: "1990-01-01" },
        hasFile: () => false,
      }),
      "Upload Passport.",
    );
    assert.equal(
      missingDocumentKyc({
        requirements,
        details: { dob: "1990-01-01" },
        hasFile: (id) => id === "passport",
      }),
      null,
    );
  });

  it("defines document requirements in admin and uses the selected gateway", () => {
    const page = readFileSync("src/app/admin/kyc/page.tsx", "utf8");
    assert.match(page, /<select name="gatewayProviderId"/);
    assert.match(page, /<select name="kind"/);
    assert.equal(page.includes("KYC through government ID"), true);
    assert.equal(page.includes("KYC through gateway"), true);
    const user = readFileSync("src/app/dashboard/kyc/page.tsx", "utf8");
    assert.equal(user.includes("government_id"), true);
    assert.equal(user.includes("pending_gateway"), true);
    const actions = readFileSync("src/app/admin/kyc/actions.ts", "utf8");
    assert.equal(actions.includes("saveKycGateway"), true);
    assert.equal(actions.includes("addKycRequirement"), true);
  });
});
