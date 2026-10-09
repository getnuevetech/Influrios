/**
 * SMS is not sent. Twilio is not the provider.
 * A template may still store an SMS body for a later provider.
 * deliverSms never calls a network, even when old credentials remain in the database or environment.
 */
export const SMS_BODY_MAX = 320;

export const SMS_NOT_SENT_MESSAGE = "SMS is not sent. Twilio is not the provider. Nothing was sent.";

export type SmsSendResult = { ok: true; provider: string; externalId?: string } | { ok: false; message: string };

export function smsProviderLabel(_configured = false) {
  return "SMS is not sent";
}

/** Fail closed. The sms_send job owns the Job row, so this does not create another. */
export async function deliverSms(input: {
  to: string;
  body: string;
  fetchImpl?: typeof fetch;
}): Promise<SmsSendResult> {
  void input.fetchImpl;
  const to = input.to.trim();
  const text = input.body.trim().slice(0, SMS_BODY_MAX);
  if (!to) return { ok: false, message: "SMS is missing a destination phone. Nothing was sent." };
  if (!text) return { ok: false, message: "SMS body is empty. Nothing was sent." };
  return { ok: false, message: SMS_NOT_SENT_MESSAGE };
}

/** Preferred-channel SMS is not queued. Email jobs stay the delivery path. */
export async function queuePreferredSms(_input: {
  email?: string;
  userId?: string;
  body: string;
  templateKey: string;
}) {
  return;
}
