"use client";

import { useEffect } from "react";

/** Restores the directory position after a profile dialog opens on the same filtered URL. */
export function DiscoverScrollMemory({ storageKey }: { storageKey: string }) {
  useEffect(() => {
    const saved = Number(sessionStorage.getItem(storageKey));
    if (Number.isFinite(saved) && saved > 0) window.scrollTo(0, saved);
    const remember = () => sessionStorage.setItem(storageKey, String(window.scrollY));
    window.addEventListener("scroll", remember, { passive: true });
    return () => window.removeEventListener("scroll", remember);
  }, [storageKey]);
  return null;
}
