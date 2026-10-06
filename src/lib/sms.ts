/**
 * SMS delivery adapters for admin templates and user preference tests.
 * Demo mode records a succeeded Job without an external provider.
 * Set SMS_PROVIDER=twilio (+ Twilio env) for live sends later.
 */
import { prisma } from "@/lib/db";

/** Max characters for SMS template bodies and outbound sends. */
export const SMS_BODY_MAX = 320;

export type SmsSendResult = { ok: true; provider: string; externalId?: string } | { ok: false; message: string };

function smsMode(): "demo" | "twilio" | "off" {
  const raw = (process.env.SMS_PROVIDER || process.env.SMS_MODE || "demo").trim().toLowerCase();
  if (raw === "twilio") return "twilio";
  if (raw === "off" || raw === "none") return "off";
  return "demo";
}

async function sendTwilioSms(input: { to: string; body: string }): Promise<SmsSendResult> {
  const sid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
  const token = (process.env.TWILIO_AUTH_TOKEN || "").trim();
  const from = (process.env.TWILIO_FROM_NUMBER || "").trim();
  if (!sid || !token || !from) {
    return { ok: false, message: "Twilio is selected but TWILIO_ACCOUNT_SID / AUTH_TOKEN / FROM_NUMBER are not set." };
  }
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const body = new URLSearchParams({ To: input.to, From: from, Body: input.body.slice(0, SMS_BODY_MAX) });
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(12_000),
    });
    const json = (await res.json().catch(() => null)) as { sid?: string; message?: string } | null;
    if (!res.ok) {
      return { ok: false, message: json?.message || `Twilio rejected the SMS (${res.status}).` };
    }
    return { ok: true, provider: "twilio", externalId: json?.sid };
  } catch {
    return { ok: false, message: "Twilio did not accept the SMS request." };
  }
}

/** Deliver SMS for template tests and preference checks. */
export async function deliverSms(input: {
  to: string;
  body: string;
  templateKey?: string;
  kind?: string;
}): Promise<SmsSendResult> {
  const to = input.to.trim();
  const text = input.body.trim().slice(0, SMS_BODY_MAX);
  if (!to) return { ok: false, message: "Add a destination phone or email for the SMS test." };
  if (!text) return { ok: false, message: "SMS body is empty." };

  const mode = smsMode();
  if (mode === "off") {
    return { ok: false, message: "SMS_PROVIDER is off. Set SMS_PROVIDER=demo or twilio." };
  }

  let result: SmsSendResult;
  if (mode === "twilio") {
    result = await sendTwilioSms({ to, body: text });
  } else {
    result = {
      ok: true,
      provider: "demo",
      externalId: `demo_sms_${Date.now().toString(36)}`,
    };
  }

  try {
    await prisma.job.create({
      data: {
        kind: input.kind || "sms_send",
        status: result.ok ? "succeeded" : "failed",
        lastError: result.ok ? null : result.message,
        payload: {
          to,
          templateKey: input.templateKey ?? null,
          channel: "sms",
          provider: result.ok ? result.provider : mode,
          externalId: result.ok ? result.externalId ?? null : null,
          preview: text,
        },
      },
    });
  } catch {
    /* delivery result still stands */
  }

  if (result.ok && mode === "demo") {
    return {
      ok: true,
      provider: "demo",
      externalId: result.externalId,
    };
  }
  return result;
}

export function smsProviderLabel() {
  const mode = smsMode();
  if (mode === "twilio") return "Twilio";
  if (mode === "off") return "Off";
  return "Demo (logs succeeded Jobs; no carrier)";
}
