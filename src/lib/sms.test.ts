import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deliverSms, postTwilioMessage, smsProviderLabel } from "./sms";

describe("Twilio SMS", () => {
  it("names Twilio only when credentials exist", () => {
    assert.equal(smsProviderLabel(true), "Twilio");
    assert.match(smsProviderLabel(false), /not configured/);
  });

  it("fails closed when Twilio is not configured", async () => {
    const previous = {
      provider: process.env.SMS_PROVIDER,
      sid: process.env.TWILIO_ACCOUNT_SID,
      token: process.env.TWILIO_AUTH_TOKEN,
      from: process.env.TWILIO_FROM_NUMBER,
    };
    process.env.SMS_PROVIDER = "off";
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
    try {
      const result = await deliverSms({ to: "+15555550100", body: "Hello" });
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.match(result.message, /not configured/);
        assert.equal(result.message.includes("demo_sms"), false);
      }
    } finally {
      if (previous.provider === undefined) delete process.env.SMS_PROVIDER;
      else process.env.SMS_PROVIDER = previous.provider;
      if (previous.sid === undefined) delete process.env.TWILIO_ACCOUNT_SID;
      else process.env.TWILIO_ACCOUNT_SID = previous.sid;
      if (previous.token === undefined) delete process.env.TWILIO_AUTH_TOKEN;
      else process.env.TWILIO_AUTH_TOKEN = previous.token;
      if (previous.from === undefined) delete process.env.TWILIO_FROM_NUMBER;
      else process.env.TWILIO_FROM_NUMBER = previous.from;
    }
  });

  it("returns the Twilio message id when the provider accepts the SMS", async () => {
    let auth = "";
    const result = await postTwilioMessage({
      config: { accountSid: "AC123", authToken: "token", from: "+15555550199" },
      to: "+15555550100",
      body: "Your code is 123456",
      fetchImpl: async (_url, init) => {
        auth = String((init?.headers as Record<string, string>)?.Authorization ?? "");
        return new Response(JSON.stringify({ sid: "SM123" }), { status: 201 });
      },
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.externalId, "SM123");
    assert.match(auth, /^Basic /);
  });
});
