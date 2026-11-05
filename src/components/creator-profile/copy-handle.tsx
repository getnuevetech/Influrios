"use client";

import { useState } from "react";
import { IconCopy } from "@/components/icons";

export function CopyHandle({ handle }: { handle: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-violet"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`@${handle}`);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          /* ignore */
        }
      }}
      aria-label="Copy handle"
    >
      <span>@{handle}</span>
      <IconCopy size={14} />
      {copied ? <span className="text-[11px] font-semibold text-emerald-700">Copied</span> : null}
    </button>
  );
}
