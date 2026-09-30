"use client";

import { useState } from "react";

export function SaveMatchButton({ compact = false }: { compact?: boolean }) {
  const [saved, setSaved] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setSaved((value) => !value)}
      className={compact ? "btn-secondary !px-3 !py-1.5 text-xs" : "btn-secondary"}
      aria-pressed={saved}
    >
      {saved ? "Saved" : "Save Match"}
    </button>
  );
}
