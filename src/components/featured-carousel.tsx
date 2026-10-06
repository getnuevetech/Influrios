"use client";

import { useRef, type ReactNode } from "react";
import { IconArrowLeft, IconArrowRight } from "@/components/icons";

/**
 * Client-only scroll shell. Cards are rendered on the server and passed as children
 * so webpack never pulls server actions / fs modules into the client graph.
 */
export function FeaturedCarousel({
  children,
  stepPx = 284,
}: {
  children: ReactNode;
  stepPx?: number;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  function scrollByDir(dir: -1 | 1) {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * stepPx, behavior: "smooth" });
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
        {children}
      </div>
    </div>
  );
}

/** Alias used by homepage category / collaboration rows. */
export const HorizontalScroller = FeaturedCarousel;
