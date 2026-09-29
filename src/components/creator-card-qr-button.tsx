"use client";

import { useState } from "react";
import { InfluencerCardModal } from "@/components/influencer-card-modal";
import type { SeedCreator } from "@/lib/seed-data";

type Props = {
  creator: SeedCreator;
  qrSize: number;
  /** When false, show a dashed Card placeholder (no QR entitlement). */
  hasQr: boolean;
};

/** Discover-grid QR: opens the Influencer Card as a popup (not a new page). */
export function CreatorCardQrButton({ creator, qrSize, hasQr }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={
          hasQr
            ? "relative z-10 shrink-0 overflow-hidden rounded-sm border border-border bg-white transition hover:ring-2 hover:ring-blue/40"
            : "relative z-10 flex shrink-0 items-center justify-center rounded-sm border border-dashed border-border text-[8px] font-bold text-muted transition hover:border-violet hover:text-violet"
        }
        style={{ width: qrSize, height: qrSize }}
        title="Open Influencer Card"
        aria-label={`Open ${creator.displayName} Influencer Card`}
      >
        {hasQr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/qr/${creator.slug}?size=${Math.max(64, qrSize * 3)}&logo=0`}
            alt=""
            width={qrSize}
            height={qrSize}
            className="h-full w-full object-contain"
          />
        ) : (
          "Card"
        )}
      </button>
      <InfluencerCardModal creator={creator} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
