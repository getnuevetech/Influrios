import { createHmac, timingSafeEqual } from "crypto";

export type EnvelopeParty = { name: string; email: string };

export type EnvelopeRequest = {
  collaborationId: string;
  title: string;
  documentHtml: string;
  parties: EnvelopeParty[];
};

export function verifyDocuSignSignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const digest = createHmac("sha256", secret).update(body).digest("base64");
  const presented = Buffer.from(signature);
  const expected = Buffer.from(digest);
  if (presented.length !== expected.length) return false;
  return timingSafeEqual(presented, expected);
}

export function parseDocuSignWebhook(body: string):
  | { ok: true; envelopeId: string; status: "sent" | "completed" | "declined" | "voided"; eventId: string }
  | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return { ok: false, error: "Invalid JSON." };
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, error: "Invalid payload." };
  const record = parsed as { event?: unknown; data?: { envelopeId?: unknown; envelopeSummary?: { status?: unknown } } };
  const envelopeId = record.data?.envelopeId;
  const statusRaw = String(record.data?.envelopeSummary?.status ?? "").toLowerCase();
  const status =
    statusRaw === "completed" || statusRaw === "declined" || statusRaw === "voided" || statusRaw === "sent"
      ? statusRaw
      : null;
  if (typeof envelopeId !== "string" || !envelopeId || !status) {
    return { ok: false, error: "Envelope id and status are required." };
  }
  const eventId = typeof record.event === "string" && record.event ? record.event : `${envelopeId}:${status}`;
  return { ok: true, envelopeId, status, eventId };
}

export async function createDocuSignEnvelope(input: {
  baseUrl: string;
  accountId: string;
  accessToken: string;
  request: EnvelopeRequest;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; envelopeId: string } | { ok: false; error: string }> {
  if (input.request.parties.length < 1) return { ok: false, error: "At least one signer is required." };
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = `${input.baseUrl.replace(/\/$/, "")}/restapi/v2.1/accounts/${encodeURIComponent(input.accountId)}/envelopes`;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      emailSubject: input.request.title,
      status: "sent",
      documents: [
        {
          documentBase64: Buffer.from(input.request.documentHtml, "utf8").toString("base64"),
          name: "contract.html",
          fileExtension: "html",
          documentId: "1",
        },
      ],
      recipients: {
        signers: input.request.parties.map((party, index) => ({
          email: party.email,
          name: party.name,
          recipientId: String(index + 1),
        })),
      },
    }),
  });
  const text = await response.text();
  if (!response.ok) return { ok: false, error: text.slice(0, 300) || "DocuSign did not create an envelope." };
  let payload: { envelopeId?: string };
  try {
    payload = JSON.parse(text) as { envelopeId?: string };
  } catch {
    return { ok: false, error: "DocuSign returned an unreadable envelope." };
  }
  if (!payload.envelopeId) return { ok: false, error: "DocuSign did not return an envelope id." };
  return { ok: true, envelopeId: payload.envelopeId };
}
