import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

function secretKey() {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    "influrios-dev-admin-secret-change-me";
  return scryptSync(secret, "influrios-provider-secrets", 32);
}

/** AES-GCM ciphertext. The admin UI never receives the plaintext back. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptSecret(payload: string): string | null {
  const [version, ivPart, tagPart, dataPart] = payload.split(".");
  if (version !== "v1" || !ivPart || !tagPart || !dataPart) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const plain = Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return null;
  }
}

export function secretStatus(cipher: string | null | undefined): "saved" | "missing" {
  return cipher ? "saved" : "missing";
}
