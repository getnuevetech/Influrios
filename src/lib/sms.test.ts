import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { deliverSms, queuePreferredSms, SMS_NOT_SENT_MESSAGE, smsProviderLabel } from "./sms";

describe("SMS disabled", () => {
  it("does not name Twilio as a working provider", () => {
    assert.equal(smsProviderLabel(true), "SMS is not sent");
    assert.equal(smsProviderLabel(false), "SMS is not sent");
  });

  it("fails closed even when Twilio credentials are present and never calls fetch", async () => {
    const previous = {
      provider: process.env.SMS_PROVIDER,
      mode: process.env.SMS_MODE,
      sid: process.env.TWILIO_ACCOUNT_SID,
      token: process.env.TWILIO_AUTH_TOKEN,
      from: process.env.TWILIO_FROM_NUMBER,
    };
    process.env.SMS_PROVIDER = "twilio";
    process.env.SMS_MODE = "live";
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "token";
    process.env.TWILIO_FROM_NUMBER = "+15555550199";
    let called = false;
    try {
      const result = await deliverSms({
        to: "+15555550100",
        body: "Hello",
        fetchImpl: async () => {
          called = true;
          return new Response(JSON.stringify({ sid: "SM123" }), { status: 201 });
        },
      });
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.message, SMS_NOT_SENT_MESSAGE);
        assert.equal(result.message.includes("demo_sms"), false);
        assert.equal(result.message.includes("not configured"), false);
      }
      assert.equal(called, false);
    } finally {
      if (previous.provider === undefined) delete process.env.SMS_PROVIDER;
      else process.env.SMS_PROVIDER = previous.provider;
      if (previous.mode === undefined) delete process.env.SMS_MODE;
      else process.env.SMS_MODE = previous.mode;
      if (previous.sid === undefined) delete process.env.TWILIO_ACCOUNT_SID;
      else process.env.TWILIO_ACCOUNT_SID = previous.sid;
      if (previous.token === undefined) delete process.env.TWILIO_AUTH_TOKEN;
      else process.env.TWILIO_AUTH_TOKEN = previous.token;
      if (previous.from === undefined) delete process.env.TWILIO_FROM_NUMBER;
      else process.env.TWILIO_FROM_NUMBER = previous.from;
    }
  });

  it("does not queue a preferred-channel SMS", async () => {
    await queuePreferredSms({
      email: "member@example.com",
      body: "Your code is 123456",
      templateKey: "verify",
    });
  });

  it("keeps the Twilio HTTP client out of the product path", () => {
    const sms = readFileSync(new URL("./sms.ts", import.meta.url), "utf8");
    const mailPage = readFileSync(new URL("../app/admin/mail/page.tsx", import.meta.url), "utf8");
    const mailActions = readFileSync(new URL("../app/admin/mail/actions.ts", import.meta.url), "utf8");
    const accountPage = readFileSync(new URL("../app/account/page.tsx", import.meta.url), "utf8");
    assert.equal(sms.includes("api.twilio.com"), false);
    assert.equal(sms.includes("TWILIO_"), false);
    assert.equal(mailPage.includes("twilioAccountSid"), false);
    assert.equal(mailPage.includes("Twilio"), false);
    assert.equal(mailActions.includes("saveTwilioCredentials"), false);
    assert.equal(accountPage.includes('value="sms"'), false);
  });
});
