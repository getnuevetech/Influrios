import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { agreementFooterAction } from "./agreement-footer";

describe("agreement popup footer", () => {
  it("asks the current party to sign before anyone can fund", () => {
    const action = agreementFooterAction({
      signHref: "/collaboration/contracts/c1#sign",
      contractHref: "/collaboration/contracts/c1",
      workspaceHref: null,
      depositHref: null,
      role: "business",
      contractStatus: "sent",
    });
    assert.deepEqual(action, { label: "Review and sign", href: "/collaboration/contracts/c1#sign" });
  });

  it("sends a signed business to the existing funding page and keeps the influencer from funding", () => {
    const business = agreementFooterAction({
      signHref: null,
      contractHref: "/collaboration/contracts/c1",
      workspaceHref: null,
      depositHref: null,
      role: "business",
      contractStatus: "signed",
    });
    assert.deepEqual(business, { label: "Fund collaboration", href: "/collaboration/contracts/c1" });
    const influencer = agreementFooterAction({
      signHref: null,
      contractHref: "/collaboration/contracts/c1",
      workspaceHref: null,
      depositHref: null,
      role: "influencer",
      contractStatus: "signed",
    });
    assert.equal(influencer, null);
  });

  it("opens the workspace after funds are confirmed and does not create a charge", () => {
    const action = agreementFooterAction({
      signHref: null,
      contractHref: "/collaboration/contracts/c1",
      workspaceHref: "/collaboration/work/f1",
      depositHref: "/payments/checkout/f1",
      role: "business",
      contractStatus: "signed",
      fundingId: "f1",
      fundingStatus: "held",
    });
    assert.deepEqual(action, { label: "Open workspace", href: "/collaboration/work/f1" });
    const deposit = agreementFooterAction({
      signHref: null,
      contractHref: "/collaboration/contracts/c1",
      workspaceHref: null,
      depositHref: "/payments/checkout/f1",
      role: "business",
      contractStatus: "signed",
      fundingId: "f1",
      fundingStatus: "awaiting_provider",
    });
    assert.deepEqual(deposit, { label: "Fund collaboration", href: "/payments/checkout/f1" });
    const source = readFileSync(new URL("./agreement-footer.ts", import.meta.url), "utf8");
    assert.equal(source.includes("createFullRefund"), false);
    assert.equal(source.includes("adapterForProvider"), false);
  });
});
