import { NextRequest, NextResponse } from "next/server";
import { parseDocuSignWebhook, verifyDocuSignSignature } from "@/lib/signing/docusign";
import { applyContractEnvelopeEvent } from "@/lib/contract-document";
import { activeSigningWebhookSecret, markSignatureFromWebhook } from "@/lib/signing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUS_EVENT = {
  completed: "signed",
  declined: "declined",
  voided: "voided",
} as const;

/**
 * DocuSign Connect webhook. A contract is signed only from a verified DocuSign event.
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

  return NextResponse.json(
    { error: "A signature is recorded when DocuSign reports every party complete. Nothing was signed." },
    { status: 400 },
  );
}
