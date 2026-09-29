"use client";

import { useEffect, useId, useRef } from "react";
import { InfluencerCardView } from "@/components/influencer-card-view";
import type { SeedCreator } from "@/lib/seed-data";

type Props = {
  creator: SeedCreator;
  open: boolean;
  onClose: () => void;
};

export function InfluencerCardModal({ creator, open, onClose }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0B123F]/55 backdrop-blur-[2px]"
        aria-label="Close card"
        onClick={onClose}
      />
      <div className="relative z-10 max-h-[min(92vh,920px)] w-full max-w-md overflow-y-auto overscroll-contain rounded-[1.75rem] shadow-2xl">
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
        <InfluencerCardView creator={creator} qrDisplay="large" />
      </div>
    </div>
  );
}
