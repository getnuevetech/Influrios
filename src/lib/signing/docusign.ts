import { createHmac, createSign, timingSafeEqual } from "crypto";

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

export type DocuSignCredentials = {
  integrationKey: string;
  userId: string;
  accountId: string;
  privateKey: string;
  baseUrl: string;
  oauthBaseUrl: string;
};

function pem(value: string) {
  const trimmed = value.trim();
  return trimmed.includes("\\n") ? trimmed.replace(/\\n/g, "\n") : trimmed;
}

export function docuSignCredentialsReady(input: {
  integrationKey: string;
  userId: string;
  accountId: string;
  privateKey: string;
  baseUrl: string;
}) {
  return Boolean(
    input.integrationKey.trim() &&
      input.userId.trim() &&
      input.accountId.trim() &&
      input.privateKey.trim() &&
      input.baseUrl.trim(),
  );
}

/** Saved admin values fill first. Environment values fill any blank field. */
export function assembleDocuSignCredentials(input: {
  stored: Partial<DocuSignCredentials>;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): { ok: true } & DocuSignCredentials | { ok: false; error: string } {
  const env = (input.env ?? process.env) as Record<string, string | undefined>;
  const credentials: DocuSignCredentials = {
    integrationKey: (input.stored.integrationKey || env.DOCUSIGN_INTEGRATION_KEY || "").trim(),
    userId: (input.stored.userId || env.DOCUSIGN_USER_ID || "").trim(),
    accountId: (input.stored.accountId || env.DOCUSIGN_ACCOUNT_ID || "").trim(),
    privateKey: pem(input.stored.privateKey || env.DOCUSIGN_PRIVATE_KEY || ""),
    baseUrl: (input.stored.baseUrl || env.DOCUSIGN_BASE_URL || "").trim(),
    oauthBaseUrl: (input.stored.oauthBaseUrl || env.DOCUSIGN_OAUTH_BASE_URL || "https://account-d.docusign.com").trim(),
  };
  if (!docuSignCredentialsReady(credentials)) {
    return {
      ok: false,
      error:
        "Add the DocuSign integration key, user id, account id, private key, and API base URL in admin. Nothing was signed.",
    };
  }
  return { ok: true, ...credentials };
}

export function docuSignJwtAssertion(input: {
  integrationKey: string;
  userId: string;
  oauthBaseUrl: string;
  privateKey: string;
  now?: number;
}) {
  const now = input.now ?? Math.floor(Date.now() / 1000);
  const audience = input.oauthBaseUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const header = Buffer.from(JSON.stringify({ typ: "JWT", alg: "RS256" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: input.integrationKey,
      sub: input.userId,
      aud: audience,
      iat: now,
      exp: now + 3600,
      scope: "signature impersonation",
    }),
  ).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(pem(input.privateKey)).toString("base64url")}`;
}

export async function requestDocuSignAccessToken(input: {
  credentials: DocuSignCredentials;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const assertion = docuSignJwtAssertion(input.credentials);
  const oauthBase = input.credentials.oauthBaseUrl.replace(/\/$/, "");
  try {
    const response = await fetchImpl(`${oauthBase}/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const text = await response.text();
    if (!response.ok) return { ok: false, error: text.slice(0, 300) || "DocuSign did not issue a token. Nothing was signed." };
    const payload = JSON.parse(text) as { access_token?: string };
    if (!payload.access_token) return { ok: false, error: "DocuSign did not issue a token. Nothing was signed." };
    return { ok: true, accessToken: payload.access_token };
  } catch {
    return { ok: false, error: "DocuSign did not issue a token. Nothing was signed." };
  }
}

export async function openDocuSignEnvelope(input: {
  credentials: DocuSignCredentials;
  request: EnvelopeRequest;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; envelopeId: string } | { ok: false; error: string }> {
  const token = await requestDocuSignAccessToken({ credentials: input.credentials, fetchImpl: input.fetchImpl });
  if (!token.ok) return token;
  return createDocuSignEnvelope({
    baseUrl: input.credentials.baseUrl,
    accountId: input.credentials.accountId,
    accessToken: token.accessToken,
    request: input.request,
    fetchImpl: input.fetchImpl,
  });
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
