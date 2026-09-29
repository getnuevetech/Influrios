"use client";

import { useRef } from "react";
import { CreatorCard } from "@/components/creator-card";
import { IconArrowLeft, IconArrowRight } from "@/components/icons";
import type { CardFeatureFlags } from "@/lib/cms";
import type { SeedCreator } from "@/lib/seed-data";

type Item = {
  creator: SeedCreator;
  features: CardFeatureFlags;
};

export function FeaturedCarousel({
  items,
  widthPx,
  socialIconSize,
  qrSize,
}: {
  items: Item[];
  widthPx: number;
  socialIconSize: number;
  qrSize: number;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  function scrollByDir(dir: -1 | 1) {
    const el = scroller.current;
    if (!el) return;
    const step = widthPx + 20;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => scrollByDir(-1)}
        className="absolute -left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-indigo shadow-lg hover:bg-lavender sm:-left-3"
        aria-label="Scroll left"
      >
        <IconArrowLeft size={18} />
      </button>
      <button
        type="button"
        onClick={() => scrollByDir(1)}
        className="absolute -right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white text-indigo shadow-lg hover:bg-lavender sm:-right-3"
        aria-label="Scroll right"
      >
        <IconArrowRight size={18} />
      </button>

      <div
        ref={scroller}
        className="flex gap-5 overflow-x-auto scroll-smooth px-1 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map(({ creator, features }) => (
          <CreatorCard
            key={creator.slug}
            creator={creator}
            widthPx={widthPx}
            socialIconSize={socialIconSize}
            qrSize={qrSize}
            features={features}
          />
        ))}
      </div>
    </div>
  );
}
