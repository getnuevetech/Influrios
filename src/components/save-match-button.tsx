"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { actionSaveMatch } from "@/app/collaboration/actions-save-match";

function SubmitLabel({ compact }: { compact?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={compact ? "btn-secondary !px-3 !py-1.5 text-xs" : "btn-secondary"}
    >
      {pending ? "Saving…" : "Save Match"}
    </button>
  );
}

/** Persists a match for signed-in users; guests continue through login to the same collaboration save destination. */
export function SaveMatchButton({
  partyASlug,
  partyBSlug,
  signedIn,
  returnTo = "/collaboration",
  compact = false,
}: {
  partyASlug: string;
  partyBSlug: string;
  signedIn: boolean;
  returnTo?: string;
  compact?: boolean;
}) {
  const saveReturn = `${returnTo}${returnTo.includes("?") ? "&" : "?"}saved=1`;
  const loginNext = `/collaboration?save=${encodeURIComponent(`${partyASlug}:${partyBSlug}`)}`;

  if (!signedIn) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(loginNext)}&gate=save`}
        className={compact ? "btn-secondary !px-3 !py-1.5 text-xs" : "btn-secondary"}
      >
        Save Match
      </Link>
    );
  }

  return (
    <form action={actionSaveMatch}>
      <input type="hidden" name="partyASlug" value={partyASlug} />
      <input type="hidden" name="partyBSlug" value={partyBSlug} />
      <input type="hidden" name="next" value={saveReturn} />
      <SubmitLabel compact={compact} />
    </form>
  );
}
