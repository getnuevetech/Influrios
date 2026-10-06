"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-70">
      {pending ? "Claiming…" : label}
    </button>
  );
}

/**
 * Claim signup form with visible pending state.
 * Native `required` / `type=email` still validate; errors also surface via `?error=` on the page.
 */
export function ClaimForm({
  action,
  children,
  submitLabel = "Claim & continue →",
}: {
  action: (formData: FormData) => void | Promise<void>;
  children: ReactNode;
  submitLabel?: string;
}) {
  return (
    <form action={action} className="space-y-3" noValidate={false}>
      {children}
      <SubmitButton label={submitLabel} />
    </form>
  );
}
