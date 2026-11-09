"use client";

import { useState } from "react";
import { IconCopy } from "@/components/icons";

export function CopyTextButton({ value, label = "Copy link" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        });
      }}
      className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-[#E4E9F5] bg-white px-3 py-2 text-sm font-semibold text-[#1B1464]"
    >
      <IconCopy size={14} />
      {copied ? "Copied" : label}
    </button>
  );
}
