import { NextRequest, NextResponse } from "next/server";
import {
  activeSigningWebhookSecret,
  markSignatureFromWebhook,
  verifySigningWebhookSignature,
} from "@/lib/signing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Provider webhook for signature lifecycle events.
 * Demo providers may omit a webhook secret; live DocuSign should set one on the provider.
 *
 * Body: { requestId?: string, externalId?: string, event: "viewed"|"signed"|"declined"|"voided" }
 * Header: x-influrios-signing-signature (HMAC-SHA256 hex of body)
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  let parsed: { requestId?: string; externalId?: string; event?: string };
  try {
    parsed = JSON.parse(body) as typeof parsed;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const event = String(parsed.event || "").trim().toLowerCase();
  if (!["viewed", "signed", "declined", "voided"].includes(event)) {
    return NextResponse.json({ error: "Unsupported event." }, { status: 400 });
  }
  if (!parsed.requestId && !parsed.externalId) {
    return NextResponse.json({ error: "Provide requestId or externalId." }, { status: 400 });
  }

  const ready = await activeSigningWebhookSecret().catch(() => ({ error: "missing" as const }));
  if ("error" in ready) {
    return NextResponse.json({ error: "No signing provider is ready." }, { status: 503 });
  }
  const signature = request.headers.get("x-influrios-signing-signature");
  if (!verifySigningWebhookSignature(body, signature, ready.secret)) {
    return NextResponse.json({ error: "Signature did not match." }, { status: 401 });
  }

  const result = await markSignatureFromWebhook({
    requestId: parsed.requestId,
    externalId: parsed.externalId,
    event: event as "viewed" | "signed" | "declined" | "voided",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: result.id, status: result.status, provider: ready.code });
}
