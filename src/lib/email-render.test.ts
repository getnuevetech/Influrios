import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { emailCopyProblems, listEmailCatalog } from "@/lib/email-catalog";
import { emailTestRecipient, publicEmailDelivery } from "@/lib/email-templates";
import { emailCopyFromCatalog, renderCatalogPreview, renderEmail } from "@/lib/email-render";

describe("email catalog renderer", () => {
  it("keeps every catalog template disabled and renderable", () => {
    const templates = listEmailCatalog();
    assert.equal(templates.length, 79);
    assert.equal(new Set(templates.map((row) => row.id)).size, 79);
    for (const template of templates) {
      assert.equal(template.enabled, false);
      const rendered = renderCatalogPreview(template);
      assert.equal(rendered.html.includes("{{"), false);
      assert.equal(rendered.html.includes("<script"), false);
      assert.equal(rendered.subject.includes("\n"), false);
      assert.match(rendered.html, /#5836D6/);
      assert.match(rendered.html, /∞ Influrios/);
    }
  });

  it("escapes hostile preview text and rejects a broken subject", () => {
    const template = listEmailCatalog().find((row) => row.id === "account.verify");
    assert.ok(template);
    const rendered = renderCatalogPreview(template, {
      subject: "Code for {{first_name}}",
      title: "<script>alert(1)</script>",
      body: ["Use {{verification_code}} only on Influrios."],
    });
    assert.equal(rendered.html.includes("<script>"), false);
    assert.match(rendered.html, /&lt;script&gt;/);
    assert.throws(
      () =>
        renderEmail({
          copy: { ...emailCopyFromCatalog(template), subject: "Line\nbreak" },
          context: { first_name: "Alex" },
        }),
      /line break/i,
    );
  });

  it("fails closed when a live variable or action host is missing", () => {
    const template = listEmailCatalog().find((row) => row.id === "account.reset");
    assert.ok(template);
    assert.throws(
      () =>
        renderEmail({
          copy: emailCopyFromCatalog(template),
          context: { first_name: "Alex" },
        }),
      /Missing template variable/,
    );
    const context = {
      first_name: "Alex",
      expires_at: "November 12, 2026",
      expires_in: "30 minutes",
      support_url: "https://influrios.example/support",
      preference_url: "https://influrios.example/account/notifications",
      action_url: "http://evil.example/reset",
    };
    assert.throws(() => renderEmail({ copy: emailCopyFromCatalog(template), context }), /https/);
  });

  it("rejects copy that invents a placeholder", () => {
    const template = listEmailCatalog().find((row) => row.id === "account.welcome_influencer");
    assert.ok(template);
    const problems = emailCopyProblems({
      template,
      subject: "Hello {{bank_account}}",
      preheader: "",
      headline: "Welcome",
      body: ["Glad you are here."],
      cta: "Open",
    });
    assert.match(problems.join(" "), /bank_account/);
  });

  it("keeps verification codes out of the delivery log", () => {
    const row = publicEmailDelivery({
      id: "job_1",
      kind: "verification_email",
      status: "queued",
      createdAt: new Date("2026-11-12T18:00:00Z"),
      lastError: null,
      payload: { email: "alex@example.com", code: "482619", text: "Your code is 482619" },
    });
    assert.equal(JSON.stringify(row).includes("482619"), false);
    assert.equal(row.subject, "Verification code");
    assert.equal(row.to, "alex@example.com");
  });

  it("accepts one typed test address and rejects a list", () => {
    assert.equal(emailTestRecipient("  Designer@Example.com "), "Designer@Example.com");
    assert.throws(() => emailTestRecipient("one@example.com, two@example.com"), /one email address/);
    assert.throws(() => emailTestRecipient("not-an-email"), /one email address/);
    assert.throws(() => emailTestRecipient("a@b.com\nBcc: x@y.com"), /one email address/);
    const dialog = readFileSync(new URL("../components/email-template-dialog.tsx", import.meta.url), "utf8");
    const action = readFileSync(new URL("../app/admin/mail/templates/actions.ts", import.meta.url), "utf8");
    assert.equal(dialog.includes("Send test to me"), false);
    assert.equal(dialog.includes("your admin address"), false);
    assert.match(dialog, /name="to"/);
    assert.equal(action.includes("to: session.email"), false);
  });
});
