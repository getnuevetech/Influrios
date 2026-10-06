/**
 * Twilio SMS. Credentials are stored encrypted on the sms/twilio provider row.
 * Environment variables are a fallback. A missing configuration fails the job.
 */
import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/provider-secrets";

export const SMS_BODY_MAX = 320;

export type SmsSendResult = { ok: true; provider: string; externalId?: string } | { ok: false; message: string };

export type TwilioConfig = { accountSid: string; authToken: string; from: string };

function fromExtra(extra: unknown): string {
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return "";
  const from = (extra as { from?: unknown }).from;
  return typeof from === "string" ? from.trim() : "";
}

export function smsProviderLabel(configured: boolean) {
  return configured ? "Twilio" : "Twilio is not configured";
}

export async function twilioSettingsView() {
  const row = await prisma.integrationProvider
    .findUnique({ where: { kind_code: { kind: "sms", code: "twilio" } } })
    .catch(() => null);
  const from = fromExtra(row?.extraJson);
  const envReady = Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_FROM_NUMBER?.trim(),
  );
  const storedReady = Boolean(row?.publicKey && row.secretCipher && from);
  return {
    accountSid: row?.publicKey ?? "",
    from,
    hasToken: Boolean(row?.secretCipher) || Boolean(process.env.TWILIO_AUTH_TOKEN?.trim()),
    configured: storedReady || envReady,
  };
}

export async function saveTwilioCredentials(input: {
  accountSid: string;
  authToken: string;
  from: string;
  clearToken?: boolean;
}) {
  const accountSid = input.accountSid.trim().slice(0, 64);
  const from = input.from.trim().slice(0, 32);
  const token = input.authToken.trim();
  if (!accountSid && !from && !token && !input.clearToken) return;
  const existing = await prisma.integrationProvider.findUnique({
    where: { kind_code: { kind: "sms", code: "twilio" } },
  });
  let secretCipher = existing?.secretCipher ?? null;
  if (input.clearToken) secretCipher = null;
  else if (token) secretCipher = encryptSecret(token);
  const nextFrom = from || fromExtra(existing?.extraJson);
  const data = {
    name: "Twilio",
    enabled: true,
    publicKey: accountSid || existing?.publicKey || null,
    secretCipher,
    extraJson: nextFrom ? { from: nextFrom } : undefined,
  };
  await prisma.integrationProvider.upsert({
    where: { kind_code: { kind: "sms", code: "twilio" } },
    create: { kind: "sms", code: "twilio", ...data },
    update: data,
  });
}

export async function loadTwilioConfig(): Promise<TwilioConfig | null> {
  if ((process.env.SMS_PROVIDER || process.env.SMS_MODE || "").trim().toLowerCase() === "off") return null;
  const row = await prisma.integrationProvider
    .findUnique({ where: { kind_code: { kind: "sms", code: "twilio" } } })
    .catch(() => null);
  if (row?.publicKey && row.secretCipher) {
    const authToken = decryptSecret(row.secretCipher);
    const from = fromExtra(row.extraJson);
    if (authToken && from) return { accountSid: row.publicKey.trim(), authToken, from };
  }
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  const from = process.env.TWILIO_FROM_NUMBER?.trim() ?? "";
  if (accountSid && authToken && from) return { accountSid, authToken, from };
  return null;
}

export async function postTwilioMessage(input: {
  config: TwilioConfig;
  to: string;
  body: string;
  fetchImpl?: typeof fetch;
}): Promise<SmsSendResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const auth = Buffer.from(`${input.config.accountSid}:${input.config.authToken}`).toString("base64");
  const form = new URLSearchParams({
    To: input.to,
    From: input.config.from,
    Body: input.body.slice(0, SMS_BODY_MAX),
  });
  try {
    const res = await fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${input.config.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
        signal: AbortSignal.timeout(12_000),
      },
    );
    const json = (await res.json().catch(() => null)) as { sid?: string; message?: string } | null;
    if (!res.ok || !json?.sid) {
      return { ok: false, message: json?.message || `Twilio rejected the SMS (${res.status}).` };
    }
    return { ok: true, provider: "twilio", externalId: json.sid };
  } catch {
    return { ok: false, message: "Twilio did not accept the SMS request." };
  }
}

/** Send one SMS. The sms_send job owns the Job row, so this does not create another. */
export async function deliverSms(input: {
  to: string;
  body: string;
  fetchImpl?: typeof fetch;
}): Promise<SmsSendResult> {
  const to = input.to.trim();
  const text = input.body.trim().slice(0, SMS_BODY_MAX);
  if (!to) return { ok: false, message: "SMS is missing a destination phone." };
  if (!text) return { ok: false, message: "SMS body is empty." };
  const config = await loadTwilioConfig();
  if (!config) return { ok: false, message: "Twilio is not configured. Nothing was sent." };
  return postTwilioMessage({ config, to, body: text, fetchImpl: input.fetchImpl });
}

/** Queue SMS for a member who prefers SMS, after the matching email trigger succeeds. */
export async function queuePreferredSms(input: { email?: string; userId?: string; body: string; templateKey: string }) {
  try {
    const settings = await prisma.commChannelSettings.findUnique({ where: { id: "default" } });
    if (!settings?.smsEnabled) return;
    const email = input.email?.trim().toLowerCase();
    const user = input.userId
      ? await prisma.user.findUnique({ where: { id: input.userId } })
      : email
        ? await prisma.user.findUnique({ where: { email } })
        : null;
    if (!user || user.preferredCommChannel !== "sms" || !user.phone) return;
    const body = input.body.trim().slice(0, SMS_BODY_MAX);
    if (!body) return;
    await prisma.job.create({
      data: {
        kind: "sms_send",
        status: "queued",
        payload: { to: user.phone, body, templateKey: input.templateKey },
      },
    });
  } catch {
    /* the email job already succeeded */
  }
}
