import { NextRequest, NextResponse } from "next/server";
import { parseDocuSignWebhook, verifyDocuSignSignature } from "@/lib/signing/docusign";
import { applyContractEnvelopeEvent } from "@/lib/contract-document";
import {
  activeSigningWebhookSecret,
  markSignatureFromWebhook,
  verifySigningWebhookSignature,
} from "@/lib/signing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_EVENT = {
  completed: "signed",
  declined: "declined",
  voided: "voided",
} as const;

/**
 * Provider webhook for signature lifecycle events.
 * DocuSign Connect uses x-docusign-signature-1 (HMAC-SHA256 base64).
 * Other providers use x-influrios-signing-signature (HMAC-SHA256 hex).
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const ready = await activeSigningWebhookSecret().catch(() => ({ error: "missing" as const }));
  if ("error" in ready) {
    return NextResponse.json({ error: "No signing provider is ready." }, { status: 503 });
  }

  const docusignSignature = request.headers.get("x-docusign-signature-1");
  const docusign = parseDocuSignWebhook(body);
  if (docusignSignature || (docusign.ok && ready.code.toLowerCase().includes("docusign"))) {
    if (!ready.secret || !verifyDocuSignSignature(body, docusignSignature, ready.secret)) {
      return NextResponse.json({ error: "Signature did not match." }, { status: 401 });
    }
    if (!docusign.ok) return NextResponse.json({ error: docusign.error }, { status: 400 });
    if (docusign.status === "sent") {
      return NextResponse.json({ ok: true, ignored: true, provider: ready.code });
    }
    const event = STATUS_EVENT[docusign.status];
    const result = await markSignatureFromWebhook({ externalId: docusign.envelopeId, event });
    const contract = await applyContractEnvelopeEvent({
      envelopeId: docusign.envelopeId,
      status: docusign.status,
    });
    if (!result.ok && !contract.applied) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({
      ok: true,
      id: result.ok ? result.id : contract.id,
      status: contract.applied ? contract.status : result.ok ? result.status : docusign.status,
      provider: ready.code,
    });
  }

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
  const signature = request.headers.get("x-influrios-signing-signature");
  if (!verifySigningWebhookSignature(body, signature, ready.secret)) {
    return NextResponse.json({ error: "Signature did not match." }, { status: 401 });
  }
  const result = await markSignatureFromWebhook({
    requestId: parsed.requestId,
    externalId: parsed.externalId,
    event: event as "viewed" | "signed" | "declined" | "voided",
  });
  const envelopeStatus = event === "signed" ? "completed" : event === "declined" || event === "voided" ? event : null;
  const contract =
    envelopeStatus && parsed.externalId
      ? await applyContractEnvelopeEvent({ envelopeId: parsed.externalId, status: envelopeStatus })
      : { applied: false as const, id: undefined, status: undefined };
  if (!result.ok && !contract.applied) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({
    ok: true,
    id: result.ok ? result.id : contract.id,
    status: contract.applied ? contract.status : result.ok ? result.status : event,
    provider: ready.code,
  });
}
