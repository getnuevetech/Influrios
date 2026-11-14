import { homePathForRole } from "@/lib/accounts";
import { isDefaultMemberHome, safeNextPath } from "@/lib/account-policy";

/** Influencer account landing. Your account, login, and Dashboard share this path. */
export const CREATOR_DASHBOARD = "/creator";

/**
 * Post-login destination. External URLs are dropped. A generic home follows the account role.
 * Another role's dashboard is not used as a silent upgrade. Other in-app paths stay so the page can re-check access.
 */
export function accountDestination(role: string | null | undefined, next: string | null | undefined): string {
  const fallback = homePathForRole(role);
  const safe = safeNextPath(next, fallback);
  if (isDefaultMemberHome(safe)) return fallback;
  const path = (safe.split("?")[0] ?? safe).split("#")[0] || safe;
  if (path === "/business/home" && role !== "BUSINESS" && role !== "AGENCY") return fallback;
  if (path === "/agency" && role !== "AGENCY") return fallback;
  if (path === "/creator" && role && role !== "CREATOR") return fallback;
  return safe;
}

/** Released earnings keep this name. Payout setup is a separate reminder and does not relabel them. */
export function dashboardEarningsLabel(payoutReady: boolean) {
  void payoutReady;
  return "Released this month";
}

export type SetupReminder = {
  id: string;
  title: string;
  detail: string;
  href: string;
  action: string;
};

/** A reminder is included only while that task is still open. */
export function openSetupReminders(input: {
  emailVerified: boolean;
  published: boolean;
  socialConnected: boolean;
  payoutReady: boolean;
}): SetupReminder[] {
  const reminders: SetupReminder[] = [];
  if (!input.emailVerified) {
    reminders.push({
      id: "email",
      title: "Verify your email",
      detail: "Confirm this account so brands can reach you.",
      href: "/account/verify",
      action: "Continue",
    });
  }
  if (!input.published) {
    reminders.push({
      id: "profile",
      title: "Publish your profile",
      detail: "Your public card is not live yet.",
      href: "/dashboard",
      action: "Continue",
    });
  }
  if (!input.socialConnected) {
    reminders.push({
      id: "social",
      title: "Connect a social account",
      detail: "Brands see the networks you connect.",
      href: "/dashboard/social",
      action: "Continue",
    });
  }
  if (!input.payoutReady) {
    reminders.push({
      id: "payout",
      title: "Complete payout setup",
      detail: "Finish your payout details to receive earnings.",
      href: "/creator/earnings#payouts",
      action: "Continue",
    });
  }
  return reminders;
}
