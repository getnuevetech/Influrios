"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { InfluencerCardView } from "@/components/influencer-card-view";
import type { EntitlementLimits } from "@/lib/entitlements";
import type { SeedCreator } from "@/lib/seed-data";

type Props = {
  creator: SeedCreator;
  entitlements?: EntitlementLimits;
  open: boolean;
  onClose: () => void;
};

/**
 * Viewport-level popup. Must portal to document.body so card transforms
 * (e.g. hover:-translate-y-1) do not trap position:fixed inside the grid card.
 */
export function InfluencerCardModal({ creator, entitlements, open, onClose }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0B123F]/60 backdrop-blur-[2px]"
        aria-label="Close card"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-[1.75rem] shadow-2xl">
        <h2 id={titleId} className="sr-only">
          {creator.displayName} Influencer Card
        </h2>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-lg font-bold text-indigo shadow ring-1 ring-border hover:bg-lavender"
          aria-label="Close"
        >
          ×
        </button>
        <InfluencerCardView creator={creator} entitlements={entitlements} qrDisplay="large" compact />
      </div>
    </div>,
    document.body,
  );
}
