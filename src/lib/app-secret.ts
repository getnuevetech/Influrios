/**
 * Session and provider-secret key.
 * Production refuses to sign or encrypt when AUTH_SECRET and ADMIN_SESSION_SECRET are both unset.
 */

const DEV_ADMIN = "influrios-dev-admin-secret-change-me";
const DEV_ACCOUNT = "influrios-account-demo";

type SecretEnv = {
  NODE_ENV?: string;
  AUTH_SECRET?: string;
  ADMIN_SESSION_SECRET?: string;
  [key: string]: string | undefined;
};

export function authSecretConfigured(env: SecretEnv = process.env): boolean {
  return Boolean(env.AUTH_SECRET?.trim() || env.ADMIN_SESSION_SECRET?.trim());
}

export function requireAuthSecret(purpose: "admin" | "account" | "provider", env: SecretEnv = process.env): string {
  const configured = env.AUTH_SECRET?.trim() || env.ADMIN_SESSION_SECRET?.trim();
  if (configured) return configured;
  if (env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required in production.");
  }
  return purpose === "account" ? DEV_ACCOUNT : DEV_ADMIN;
}
