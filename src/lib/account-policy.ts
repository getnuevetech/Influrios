export type GateDecision = "allow" | "soft" | "hard";

export type GateLimits = {
  soft: number;
  hard: number;
};

export const CONSENT_VERSION = "2026-09-30";

export const DEFAULT_GUEST_POLICY = {
  profileViewSoft: 3,
  profileViewHard: 5,
  searchSoft: 10,
  searchHard: 20,
  softCopy: "You are browsing as a guest. Create a free account to keep viewing creators.",
  hardCopy: "Create a free account to continue. We will bring you back to this page.",
};

/** Logged-in visitors are not counted. Guests soften, then hard-stop. */
export function decideGuestGate(
  count: number,
  limits: GateLimits,
  authenticated: boolean,
): GateDecision {
  if (authenticated) return "allow";
  if (!Number.isFinite(count) || count < 1) return "allow";
  const hard = Math.max(1, Math.floor(limits.hard));
  const soft = Math.min(hard, Math.max(1, Math.floor(limits.soft)));
  if (count >= hard) return "hard";
  if (count >= soft) return "soft";
  return "allow";
}

/** Only same-site paths may be used as a post-login return URL. */
export function safeNextPath(raw: string | undefined | null, fallback = "/"): string {
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) {
    return fallback;
  }
  return value;
}

export function passwordError(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (password.length > 200) return "That password is too long.";
  return null;
}
