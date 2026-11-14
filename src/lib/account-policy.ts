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

function sameSitePath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) return false;
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  let decoded = value;
  for (let pass = 0; pass < 2; pass += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return false;
    }
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\") || decoded.includes("://")) {
    return false;
  }
  return !/[\u0000-\u001f\u007f]/.test(decoded);
}

/** Only same-site paths may be used as a post-login return URL. */
export function safeNextPath(raw: string | undefined | null, fallback = "/creator"): string {
  if (!raw) return fallback;
  const value = raw.trim();
  if (!sameSitePath(value)) return fallback;
  // Legacy bare "/" sent callers to edit-profile; prefer creator Home.
  // /dashboard is My Profile and must remain a valid return path.
  if (value === "/") return fallback;
  return value;
}

/** True when the return URL is the generic creator home (role routing may still override). */
export function isDefaultMemberHome(path: string): boolean {
  return path === "/creator" || path === "/";
}

export function passwordError(password: string, minLength = 8): string | null {
  const min = Math.min(64, Math.max(8, Math.floor(minLength) || 8));
  if (password.length < min) return `Use at least ${min} characters.`;
  if (password.length > 200) return "That password is too long.";
  return null;
}
