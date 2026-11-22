import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { composerStep, composerSubmit, draftRecipientSlugs, joinDraftRecipients, requestMarketChoice, requestVisibility } from "./request-composer";

describe("request composer", () => {
  it("keeps a saved visibility and step, and restores selected recipients", () => {
    assert.equal(requestVisibility("public", true), "public");
    assert.equal(requestVisibility("private", false), "private");
    assert.equal(requestVisibility("", true), "private");
    assert.equal(composerStep("2"), 2);
    assert.equal(composerStep("9"), 0);
    assert.deepEqual(draftRecipientSlugs("ada, ben, ada"), ["ada", "ben"]);
    assert.equal(joinDraftRecipients(["ada", "ada", "ben"]), "ada,ben");
  });

  it("sends invitations on private or public briefs and publishes only a public brief", () => {
    assert.equal(composerSubmit({ intent: "draft", visibility: "private", recipientCount: 2 }).ok, true);
    assert.deepEqual(composerSubmit({ intent: "invite", visibility: "private", recipientCount: 2 }), {
      ok: true,
      action: "invite",
    });
    assert.deepEqual(composerSubmit({ intent: "invite", visibility: "public", recipientCount: 2 }), {
      ok: true,
      action: "invite",
    });
    assert.equal(composerSubmit({ intent: "invite", visibility: "private", recipientCount: 0 }).ok, false);
    assert.deepEqual(composerSubmit({ intent: "publish", visibility: "public", recipientCount: 0 }), {
      ok: true,
      action: "publish",
    });
    assert.equal(composerSubmit({ intent: "publish", visibility: "private", recipientCount: 2 }).ok, false);
  });

  it("opens one centred composer and does not send while saving a draft", () => {
    const page = readFileSync("src/app/collaboration/business/request/[id]/page.tsx", "utf8");
    const editor = readFileSync("src/components/account/request-editor.tsx", "utf8");
    const actions = readFileSync("src/app/collaboration/business/actions.ts", "utf8");
    const workspace = actions.slice(
      actions.indexOf("export async function actionWorkspaceRequest"),
      actions.indexOf("export async function actionPublishCampaign"),
    );
    assert.match(page, /role="dialog"/);
    assert.match(page, /fixed inset-0/);
    assert.equal(editor.split("Save draft").length - 1, 1);
    assert.match(editor, /Send invitations/);
    assert.match(editor, /Publish request/);
    assert.ok(workspace.indexOf("composerSubmit") < workspace.indexOf("inviteCreatorsIndependently"));
    const publish = workspace.slice(workspace.indexOf('decision.action === "publish"'));
    assert.equal(publish.includes("inviteCreatorsIndependently"), false);
    assert.equal(workspace.includes("executeHeldCancellation"), false);
  });
});

describe("request market picker", () => {
  const markets = [{ code: "US", name: "United States" }, { code: "GH", name: "Ghana" }];
  it("accepts an enabled market by name or code and normalises it", () => {
    assert.deepEqual(requestMarketChoice("united states", markets), { ok: true, name: "United States" });
    assert.deepEqual(requestMarketChoice("GH", markets), { ok: true, name: "Ghana" });
  });
  it("allows no market", () => {
    assert.deepEqual(requestMarketChoice("", markets), { ok: true, name: "" });
  });
  it("rejects free text that isn't a market, but keeps a value already saved", () => {
    assert.equal(requestMarketChoice("Narnia", markets).ok, false);
    assert.deepEqual(requestMarketChoice("Lagos, Nigeria", markets, "Lagos, Nigeria"), { ok: true, name: "Lagos, Nigeria" });
  });
});
