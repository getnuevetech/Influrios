/**
 * Edge-safe admin session cookie checks (middleware).
 * Must stay free of Node crypto / Prisma — Web Crypto only.
 * Signature algorithm matches admin-auth encodeSession (HMAC-SHA256, base64url).
 */

export const ADMIN_SESSION_COOKIE = "influrios_admin_session";

/** Same fallback as requireAuthSecret("admin") so Edge and Node verify the same cookies. */
const DEV_ADMIN_SECRET = "influrios-dev-admin-secret-change-me";

type SecretEnv = {
  NODE_ENV?: string;
  AUTH_SECRET?: string;
  ADMIN_SESSION_SECRET?: string;
};

export function edgeAdminSessionSecret(env: SecretEnv = process.env): string | null {
  const configured = env.AUTH_SECRET?.trim() || env.ADMIN_SESSION_SECRET?.trim();
  if (configured) return configured;
  if (env.NODE_ENV === "production") return null;
  return DEV_ADMIN_SECRET;
}

function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  const b64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i)! ^ b.charCodeAt(i)!;
  return out === 0;
}

async function hmacSha256Base64Url(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bufferToBase64Url(mac);
}

/**
 * True when the cookie is payload.sig, HMAC matches, and exp (when present) is in the future.
 * Does not load RBAC — Node getAdminSession still revalidates permissionVersion.
 */
export async function adminSessionCookieLooksValid(
  token: string | undefined | null,
  secret: string | null | undefined,
  nowMs: number = Date.now(),
): Promise<boolean> {
  if (!token || !secret) return false;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payload || !sig || payload.includes(".") || sig.includes(".")) return false;

  let expected: string;
  try {
    expected = await hmacSha256Base64Url(secret, payload);
  } catch {
    return false;
  }
  if (!timingSafeEqualString(sig, expected)) return false;

  try {
    const json =
      typeof atob === "function"
        ? atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
        : Buffer.from(payload, "base64url").toString("utf8");
    const session = JSON.parse(json) as { exp?: number; userId?: string };
    if (!session.userId || typeof session.userId !== "string") return false;
    if (typeof session.exp !== "number" || nowMs > session.exp) return false;
  } catch {
    return false;
  }
  return true;
}
