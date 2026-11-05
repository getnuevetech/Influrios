import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  applyMetaWebhookChanges,
  getMetaWebhookConfig,
  parseMetaWebhookPayload,
  verifyMetaSubscriptionChallenge,
  verifyMetaWebhookSignature,
} from "@/lib/meta-webhook";
import { noteWebhook } from "@/lib/webhook-idempotency";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Meta Instagram / Facebook webhook ingestion.
 * GET verifies the subscription handshake. POST accepts signed events.
 * OAuth login stays on /api/social/callback — do not reuse that path here.
 */
export async function GET(request: NextRequest) {
  const config = await getMetaWebhookConfig().catch(() => null);
  const result = verifyMetaSubscriptionChallenge({
    mode: request.nextUrl.searchParams.get("hub.mode"),
    token: request.nextUrl.searchParams.get("hub.verify_token"),
    challenge: request.nextUrl.searchParams.get("hub.challenge"),
    expectedToken: config?.verifyToken ?? "",
  });
  if (!result.ok) {
    return new NextResponse(result.error, {
      status: result.status,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return new NextResponse(result.challenge, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function POST(request: NextRequest) {
  const config = await getMetaWebhookConfig().catch(() => null);
  if (!config?.appSecret) {
    return NextResponse.json({ error: "Meta app secret is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature =
    request.headers.get("x-hub-signature-256") || request.headers.get("X-Hub-Signature-256");
  if (!verifyMetaWebhookSignature(rawBody, signature, config.appSecret)) {
    return NextResponse.json({ error: "Signature did not match." }, { status: 401 });
  }

  let payload: unknown = null;
  try {
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const changes = parseMetaWebhookPayload(payload);
  const object =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? String((payload as { object?: unknown }).object ?? "meta")
      : "meta";
  const entryIds = [...new Set(changes.map((change) => change.entryId).filter(Boolean))].slice(0, 5);
  const eventId =
    entryIds.length > 0
      ? `meta:${object}:${entryIds.join(",")}:${bodyDigest(rawBody)}`
      : `meta:${object}:${bodyDigest(rawBody)}`;

  const noted = await noteWebhook({
    provider: "meta",
    eventId,
    eventType: changes[0]?.field ? `meta.${changes[0].field}` : `meta.${object}`,
    result: "accepted",
  }).catch(() => ({ stored: false }));

  // Always acknowledge quickly. Duplicate deliveries leave accounts untouched.
  if (noted.stored && changes.length) {
    await applyMetaWebhookChanges(changes).catch(() => null);
  }

  return NextResponse.json({ ok: true });
}

function bodyDigest(rawBody: string) {
  return createHash("sha256").update(rawBody, "utf8").digest("hex").slice(0, 24);
}
