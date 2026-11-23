import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

describe("admin deal pages", () => {
  it("lists every agreement on Deals, with a status filter and signature progress", () => {
    const deals = read("src/app/admin/deals/page.tsx");
    assert.match(deals, /name="status"/);
    assert.match(deals, /contractPartyProgress/);
    assert.match(deals, /href=\{`\/admin\/deals\/\$\{document\.id\}`\}/);
  });

  it("keeps only the template and the agreements awaiting signatures on Contracts", () => {
    const contracts = read("src/app/admin/contracts/page.tsx");
    assert.match(contracts, /status: \{ in: \["draft", "sent"\] \}/);
    assert.match(contracts, /Awaiting signatures/);
    assert.match(contracts, /actionSaveContractTemplate/);
    assert.equal(contracts.includes("Fully signed</h3>"), false);
    assert.match(contracts, /See every agreement on Deals/);
  });

  it("keeps Document signing to provider setup", () => {
    const signing = read("src/app/admin/signing/page.tsx");
    assert.equal(signing.includes("Live contract agreements"), false);
    assert.equal(signing.includes("ContractDocumentsPreview"), false);
    assert.match(signing, /requests\.length > 0 \?/);
    assert.equal(read("src/lib/providers.ts").includes("queueSignatureRequest"), false);
  });

  it("names the creator-to-creator page Proposals in the admin menu", () => {
    assert.match(read("src/app/admin/layout.tsx"), /href: "\/admin\/collaborations", label: "Proposals"/);
  });
});
