"use client";

import { useEffect, useState } from "react";
import { isStaleServerAction } from "@/lib/stale-server-action";

const RELOAD_KEY = "influrios-stale-action-at";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const stale = isStaleServerAction(error);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!stale) return;
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 60_000) {
      setHeld(true);
      return;
    }
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    window.location.reload();
  }, [stale]);

  if (stale) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-indigo">Admin page expired</h1>
        <p className="mt-2 text-sm text-muted">
          {held
            ? "This page was opened against an older version of the app. Reload it, then enter the details again and save."
            : "This page was opened against an older version of the app. Reloading so Save can run."}
        </p>
        <button type="button" onClick={() => window.location.reload()} className="btn-primary mt-6 !px-5 !py-2 text-sm">
          Reload page
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-bold text-indigo">Admin unavailable</h1>
      <p className="mt-2 text-sm text-muted">
        Something went wrong loading this admin view.
        {error.message ? ` (${error.message})` : null}
      </p>
      <button type="button" onClick={reset} className="btn-primary mt-6 !px-5 !py-2 text-sm">
        Try again
      </button>
    </div>
  );
}
