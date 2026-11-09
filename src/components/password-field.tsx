"use client";

import { useState } from "react";

export function PasswordField({
  name = "password",
  placeholder = "Enter your password",
  minLength,
  autoComplete = "current-password",
}: {
  name?: string;
  placeholder?: string;
  minLength?: number;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative mt-1">
      <input
        name={name}
        type={visible ? "text" : "password"}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[#E4E9F5] px-3 py-3 pr-12 text-sm font-normal outline-none focus:border-violet"
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#667085]"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
