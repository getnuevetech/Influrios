import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/provider-secrets";
import { parseDocuSignWebhook, verifyDocuSignSignature } from "@/lib/signing/docusign";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * DocuSign Connect. completed is written only after the signature matches.
 * A replay of the same event id does not change the row again.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const parsed = parseDocuSignWebhook(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const requestRow = await prisma.signatureRequest.findFirst({
    where: { externalId: parsed.envelopeId },
    include: { provider: true },
  });
  if (!requestRow?.provider?.webhookCipher) {
    return NextResponse.json({ error: "Unknown envelope." }, { status: 404 });
  }
  const secret = decryptSecret(requestRow.provider.webhookCipher);
  if (!secret || !verifyDocuSignSignature(body, request.headers.get("x-docusign-signature"), secret)) {
    return NextResponse.json({ error: "Signature did not match." }, { status: 401 });
  }

  const seen = await prisma.processedWebhook.findUnique({
    where: { provider_eventId: { provider: "docusign", eventId: parsed.eventId } },
  }).catch(() => null);
  if (seen) return NextResponse.json({ ok: true, duplicate: true });

  await prisma.$transaction([
    prisma.signatureRequest.update({
      where: { id: requestRow.id },
      data: { status: parsed.status, lastError: null },
    }),
    prisma.processedWebhook.create({
      data: {
        provider: "docusign",
        eventId: parsed.eventId,
        eventType: parsed.status,
        result: "applied",
      },
    }),
  ]);
  return NextResponse.json({ ok: true, status: parsed.status });
}
