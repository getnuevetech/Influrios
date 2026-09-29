"use client";

import { actionAddShortlist } from "@/app/business/actions";
import { IconHeart } from "@/components/icons";

/** Isolated client form so featured cards never pull server libs into the carousel bundle. */
export function ShortlistHeartButton({
  slug,
  note = "Saved from Discover",
}: {
  slug: string;
  note?: string;
}) {
  return (
    <form action={actionAddShortlist} className="absolute right-3 top-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="note" value={note} />
      <button
        type="submit"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-violet shadow"
        aria-label="Add to business shortlist"
        title="Add to shortlist"
      >
        <IconHeart size={15} />
      </button>
    </form>
  );
}
