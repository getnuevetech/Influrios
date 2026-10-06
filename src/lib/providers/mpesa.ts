import { createHmac, timingSafeEqual } from "crypto";
import type { RegionalCharge } from "@/lib/providers/flutterwave";

export function verifyMpesaSignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const digest = createHmac("sha256", secret).update(body).digest("hex");
  const presented = Buffer.from(signature);
  const expected = Buffer.from(digest);
  if (presented.length !== expected.length) return false;
  return timingSafeEqual(presented, expected);
}

export function parseMpesaWebhook(body: string): { ok: true; charge: RegionalCharge } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, error: "Invalid JSON." };
  }
  const root = parsed && typeof parsed === "object" ? (parsed as { Body?: { stkCallback?: Record<string, unknown> } }) : null;
  const callback = root?.Body?.stkCallback;
  if (!callback) return { ok: false, error: "Invalid payload." };
  const checkoutId = typeof callback.CheckoutRequestID === "string" ? callback.CheckoutRequestID : "";
  const merchantId = typeof callback.MerchantRequestID === "string" ? callback.MerchantRequestID : "";
  if (!checkoutId) return { ok: false, error: "M-Pesa event is missing a checkout id." };
  const resultCode = Number(callback.ResultCode);
  const txRef = typeof callback.tx_ref === "string" ? callback.tx_ref : checkoutId;
  return {
    ok: true,
    charge: {
      provider: "mpesa",
      eventId: `mpesa:${merchantId || checkoutId}`,
      txRef,
      paid: resultCode === 0,
      amountCents: 0,
    },
  };
}

export async function createMpesaCharge(input: {
  secret: string;
  baseUrl?: string;
  shortCode: string;
  txRef: string;
  amountCents: number;
  phone: string;
  callbackUrl: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; checkoutRequestId: string } | { ok: false; error: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const base = (input.baseUrl || "https://sandbox.safaricom.co.ke").replace(/\/$/, "");
  try {
    const response = await fetchImpl(`${base}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${input.secret}`, "content-type": "application/json" },
      body: JSON.stringify({
        BusinessShortCode: input.shortCode,
        Amount: Math.max(1, Math.round(input.amountCents / 100)),
        PartyA: input.phone,
        PartyB: input.shortCode,
        PhoneNumber: input.phone,
        CallBackURL: input.callbackUrl,
        AccountReference: input.txRef,
        TransactionDesc: input.txRef,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    const json = (await response.json().catch(() => null)) as {
      CheckoutRequestID?: string;
      ResponseCode?: string;
      errorMessage?: string;
    } | null;
    if (!response.ok || json?.ResponseCode !== "0" || !json.CheckoutRequestID) {
      return { ok: false, error: json?.errorMessage || "M-Pesa did not open a charge." };
    }
    return { ok: true, checkoutRequestId: json.CheckoutRequestID };
  } catch {
    return { ok: false, error: "M-Pesa did not accept the charge." };
  }
}
