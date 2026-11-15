"use client";

import { useEffect } from "react";

export function WorkspaceScroll({ fundingId }: { fundingId: string }) {
  useEffect(() => {
    const key = `influrios-workspace-scroll:${fundingId}`;
    const saved = sessionStorage.getItem(key);
    if (saved) {
      const y = Number(saved);
      if (Number.isFinite(y)) window.scrollTo(0, y);
      sessionStorage.removeItem(key);
    }
    function remember() {
      sessionStorage.setItem(key, String(window.scrollY));
    }
    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest("[data-keep-scroll]")) return;
      remember();
    }
    function onSubmit(event: Event) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.hasAttribute("data-keep-scroll")) return;
      remember();
    }
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
    };
  }, [fundingId]);
  return null;
}
