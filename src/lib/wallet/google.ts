/**
 * Google Wallet: a Generic pass. "Save to Google Wallet" is a link to https://pay.google.com/gp/v/save/{JWT};
 * the JWT is signed (RS256) with the issuer's service account and carries the pass class and object.
 * Later changes are pushed with the Wallet REST API, so saved passes update on the phone.
 */
import { createSign } from "crypto";
import { appOrigin } from "@/lib/creator-og";
import { WALLET_COLORS, type WalletCard } from "@/lib/wallet/card";
import type { GoogleWalletConfig } from "@/lib/wallet/config";

const API = "https://walletobjects.googleapis.com/walletobjects/v1";

const b64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");
const text = (value: string) => ({ defaultValue: { language: "en-US", value } });

export function googleIds(card: Pick<WalletCard, "serial">, issuerId: string) {
  return { classId: `${issuerId}.influrios_card`, objectId: `${issuerId}.card_${card.serial.replace(/[^A-Za-z0-9_.-]/g, "_")}` };
}

export function googlePassClass(issuerId: string) {
  return {
    id: `${issuerId}.influrios_card`,
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          {
            twoItems: {
              startItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['specialty']" }] } },
              endItem: { firstValue: { fields: [{ fieldPath: "object.textModulesData['location']" }] } },
            },
          },
        ],
      },
    },
  };
}

export function googlePassObject(card: WalletCard, issuerId: string, origin = appOrigin()) {
  const { classId, objectId } = googleIds(card, issuerId);
  return {
    id: objectId,
    classId,
    state: "ACTIVE",
    hexBackgroundColor: WALLET_COLORS.background,
    logo: { sourceUri: { uri: `${origin}/api/wallet/brand/logo.png` }, contentDescription: text("Influrios") },
    cardTitle: text("Influrios Card"),
    subheader: text(card.title),
    header: text(card.name),
    ...(card.photoUrl?.startsWith("https://")
      ? { heroImage: { sourceUri: { uri: card.photoUrl }, contentDescription: text(card.name) } }
      : {}),
    barcode: { type: "QR_CODE", value: card.cardUrl, alternateText: card.cardLabel },
    textModulesData: [
      ...(card.specialties ? [{ id: "specialty", header: "Specialty", body: card.specialties }] : []),
      ...(card.location ? [{ id: "location", header: "Based in", body: card.location }] : []),
      ...card.socials.map((row, index) => ({ id: `social${index}`, header: row.label, body: row.value })),
    ],
    linksModuleData: { uris: [{ id: "card", uri: card.cardUrl, description: "Open Influrios Card" }] },
  };
}

function signJwt(payload: object, config: GoogleWalletConfig) {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const signature = createSign("RSA-SHA256").update(`${header}.${body}`).sign(config.privateKeyPem);
  return `${header}.${body}.${b64url(signature)}`;
}

/** The "Save to Google Wallet" link for one influencer card. */
export function googleSaveUrl(card: WalletCard, config: GoogleWalletConfig, origin = appOrigin()) {
  const jwt = signJwt(
    {
      iss: config.serviceAccountEmail,
      aud: "google",
      typ: "savetowallet",
      iat: Math.floor(Date.now() / 1000),
      origins: [origin],
      payload: { genericClasses: [googlePassClass(config.issuerId)], genericObjects: [googlePassObject(card, config.issuerId, origin)] },
    },
    config,
  );
  return `https://pay.google.com/gp/v/save/${jwt}`;
}

async function accessToken(config: GoogleWalletConfig) {
  const now = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    {
      iss: config.serviceAccountEmail,
      scope: "https://www.googleapis.com/auth/wallet_object.issuer",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    },
    config,
  );
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(8000),
  });
  const data = (await response.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
  if (!response.ok || !data.access_token) throw new Error(data.error_description || `Google sign-in failed (${response.status}).`);
  return data.access_token;
}

/** Update a saved pass. "missing" means nobody has saved this card yet (nothing to update). */
export async function updateGooglePass(card: WalletCard, config: GoogleWalletConfig) {
  const token = await accessToken(config);
  const object = googlePassObject(card, config.issuerId);
  const response = await fetch(`${API}/genericObject/${encodeURIComponent(object.id)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(object),
    signal: AbortSignal.timeout(8000),
  });
  if (response.status === 404) return "missing" as const;
  if (!response.ok) throw new Error(`Google Wallet update failed (${response.status}).`);
  return "updated" as const;
}

/** Check the saved Google credentials by asking for an access token. */
export async function checkGoogleCredentials(config: GoogleWalletConfig) {
  try {
    await accessToken(config);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Google sign-in failed." };
  }
}
