/** Influencer account landing. Your account, login, and Dashboard share this path. */
export const CREATOR_DASHBOARD = "/creator";

export function dashboardEarningsLabel(payoutReady: boolean) {
  return payoutReady ? "Payouts processing" : "Awaiting payout setup";
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
