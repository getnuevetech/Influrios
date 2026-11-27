/**
 * Wallet pass credentials, saved encrypted by an admin (Admin → Wallet passes).
 * Apple: Pass Type ID certificate + key, Team ID and Apple's WWDR intermediate certificate.
 * Google: Wallet issuer id and a service account key.
 */
import { prisma } from "@/lib/db";

export const APPLE_WALLET_KEY = "wallet.apple";
export const GOOGLE_WALLET_KEY = "wallet.google";

export type AppleWalletConfig = {
  passTypeIdentifier: string;
  teamIdentifier: string;
  certificatePem: string;
  privateKeyPem: string;
  privateKeyPassphrase: string;
  wwdrPem: string;
};

export type GoogleWalletConfig = {
  issuerId: string;
  serviceAccountEmail: string;
  privateKeyPem: string;
};

async function readEncrypted<T>(key: string): Promise<Partial<T> | null> {
  const row = await prisma.platformSetting.findUnique({ where: { key } }).catch(() => null);
  const sealed = row?.value && typeof row.value === "object" ? (row.value as { sealed?: unknown }).sealed : null;
  if (typeof sealed !== "string") return null;
  const { decryptSecret } = await import("@/lib/provider-secrets");
  const plain = decryptSecret(sealed);
  if (!plain) return null;
  try {
    return JSON.parse(plain) as Partial<T>;
  } catch {
    return null;
  }
}

async function writeEncrypted(key: string, value: unknown) {
  const { encryptSecret } = await import("@/lib/provider-secrets");
  const stored = { sealed: encryptSecret(JSON.stringify(value)), savedAt: new Date().toISOString() };
  await prisma.platformSetting.upsert({ where: { key }, create: { key, value: stored }, update: { value: stored } });
}

export function appleConfigComplete(config: Partial<AppleWalletConfig> | null): config is AppleWalletConfig {
  return Boolean(
    config?.passTypeIdentifier?.startsWith("pass.") &&
      /^[A-Z0-9]{10}$/.test(config.teamIdentifier ?? "") &&
      config.certificatePem?.includes("BEGIN CERTIFICATE") &&
      config.privateKeyPem?.includes("PRIVATE KEY") &&
      config.wwdrPem?.includes("BEGIN CERTIFICATE"),
  );
}

export function googleConfigComplete(config: Partial<GoogleWalletConfig> | null): config is GoogleWalletConfig {
  return Boolean(
    /^\d{6,}$/.test(config?.issuerId ?? "") && config?.serviceAccountEmail?.includes("@") && config.privateKeyPem?.includes("PRIVATE KEY"),
  );
}

export async function getAppleWalletConfig() {
  const config = await readEncrypted<AppleWalletConfig>(APPLE_WALLET_KEY);
  return appleConfigComplete(config) ? { ...config, privateKeyPassphrase: config.privateKeyPassphrase ?? "" } : null;
}

export async function getGoogleWalletConfig() {
  const config = await readEncrypted<GoogleWalletConfig>(GOOGLE_WALLET_KEY);
  return googleConfigComplete(config) ? config : null;
}

/** Keep what is already saved for any field left blank, so secrets need not be re-pasted. */
export async function saveAppleWalletConfig(input: Partial<AppleWalletConfig>) {
  const current = (await readEncrypted<AppleWalletConfig>(APPLE_WALLET_KEY)) ?? {};
  const next = { ...current };
  for (const [field, value] of Object.entries(input) as [keyof AppleWalletConfig, string | undefined][]) {
    if (value && value.trim()) next[field] = value.trim();
  }
  if (next.passTypeIdentifier && !next.passTypeIdentifier.startsWith("pass.")) {
    return { ok: false as const, error: "The Pass Type ID starts with pass. (for example pass.com.influrios.card)." };
  }
  if (next.teamIdentifier && !/^[A-Z0-9]{10}$/.test(next.teamIdentifier)) {
    return { ok: false as const, error: "The Team ID is 10 letters and numbers, as shown in your Apple Developer account." };
  }
  await writeEncrypted(APPLE_WALLET_KEY, next);
  return { ok: true as const, complete: appleConfigComplete(next) };
}

export async function saveGoogleWalletConfig(input: { issuerId?: string; serviceAccountJson?: string }) {
  const current = (await readEncrypted<GoogleWalletConfig>(GOOGLE_WALLET_KEY)) ?? {};
  const next: Partial<GoogleWalletConfig> = { ...current };
  if (input.issuerId?.trim()) next.issuerId = input.issuerId.trim();
  if (input.serviceAccountJson?.trim()) {
    try {
      const parsed = JSON.parse(input.serviceAccountJson) as { client_email?: string; private_key?: string };
      if (!parsed.client_email || !parsed.private_key) throw new Error("missing");
      next.serviceAccountEmail = parsed.client_email;
      next.privateKeyPem = parsed.private_key;
    } catch {
      return { ok: false as const, error: "Paste the whole service account key file (JSON) from Google Cloud." };
    }
  }
  if (next.issuerId && !/^\d{6,}$/.test(next.issuerId)) {
    return { ok: false as const, error: "The issuer ID is the number shown in the Google Pay & Wallet Console." };
  }
  await writeEncrypted(GOOGLE_WALLET_KEY, next);
  return { ok: true as const, complete: googleConfigComplete(next) };
}

export async function clearWalletConfig(key: typeof APPLE_WALLET_KEY | typeof GOOGLE_WALLET_KEY) {
  await prisma.platformSetting.delete({ where: { key } }).catch(() => null);
}

/** What admins see: which fields are saved, never the secrets. */
export async function walletConfigStatus() {
  const [apple, google] = await Promise.all([
    readEncrypted<AppleWalletConfig>(APPLE_WALLET_KEY),
    readEncrypted<GoogleWalletConfig>(GOOGLE_WALLET_KEY),
  ]);
  return {
    apple: {
      ready: appleConfigComplete(apple),
      passTypeIdentifier: apple?.passTypeIdentifier ?? "",
      teamIdentifier: apple?.teamIdentifier ?? "",
      hasCertificate: Boolean(apple?.certificatePem),
      hasPrivateKey: Boolean(apple?.privateKeyPem),
      hasWwdr: Boolean(apple?.wwdrPem),
    },
    google: {
      ready: googleConfigComplete(google),
      issuerId: google?.issuerId ?? "",
      serviceAccountEmail: google?.serviceAccountEmail ?? "",
    },
  };
}

export async function walletAvailability() {
  const status = await walletConfigStatus().catch(() => null);
  return { apple: Boolean(status?.apple.ready), google: Boolean(status?.google.ready) };
}
