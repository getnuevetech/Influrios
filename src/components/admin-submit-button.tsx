"use client";

import { useFormStatus } from "react-dom";

/** Submit control that shows a pending label while a server action runs. */
export function AdminSubmitButton({
  label,
  pendingLabel,
  className = "btn-primary !py-2 text-sm",
}: {
  label: string;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-70`}>
      {pending ? pendingLabel : label}
    </button>
  );
}
