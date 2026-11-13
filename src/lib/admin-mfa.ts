export type AdminMfaState = "enabled" | "not_enabled" | "unavailable";

/** Admin sign-in does not enroll a second factor today. Say so instead of "Unknown". */
export function adminMfaPresentation(input: { offered: boolean; enabled: boolean }): {
  state: AdminMfaState;
  label: string;
  detail: string;
} {
  if (!input.offered) {
    return {
      state: "unavailable",
      label: "Unavailable",
      detail: "Admin sign-in does not offer a second factor.",
    };
  }
  if (input.enabled) {
    return {
      state: "enabled",
      label: "Enabled",
      detail: "A second factor is on for this admin.",
    };
  }
  return {
    state: "not_enabled",
    label: "Not enabled",
    detail: "This admin has not turned on a second factor.",
  };
}
