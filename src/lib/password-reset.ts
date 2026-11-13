/** What the reset page should show. An unusable token cannot set a password. */
export function resetPasswordScreen(input: { hasToken: boolean; usable: boolean }): "choose-password" | "request-link" {
  if (input.hasToken && input.usable) return "choose-password";
  return "request-link";
}
