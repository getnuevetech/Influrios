"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { focusableElements, isDismissKey, nextFocusIndex } from "@/lib/dialog-behavior";

export function useAccountDialogBehavior(
  panelRef: RefObject<HTMLElement | null>,
  dismiss: () => void,
  active = true,
) {
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;

  useEffect(() => {
    if (!active) return;
    const panel = panelRef.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const root = panel?.closest("[data-account-dialog-root]");
    const inerted: HTMLElement[] = [];
    if (root) {
      for (const child of Array.from(document.body.children)) {
        if (!(child instanceof HTMLElement) || child === root || child.contains(root) || child.hasAttribute("inert")) continue;
        child.setAttribute("inert", "");
        inerted.push(child);
      }
    }
    const items = panel ? focusableElements(panel) : [];
    (items[0] ?? panel)?.focus();

    function onKey(event: KeyboardEvent) {
      if (isDismissKey(event.key)) {
        event.preventDefault();
        dismissRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = focusableElements(panel);
      event.preventDefault();
      if (focusable.length === 0) {
        panel.focus();
        return;
      }
      const current = focusable.indexOf(document.activeElement as HTMLElement);
      focusable[nextFocusIndex(focusable.length, current, event.shiftKey)]?.focus();
    }

    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      for (const element of inerted) element.removeAttribute("inert");
      previous?.focus();
    };
  }, [active, panelRef]);
}

export function AccountDialog({
  title,
  closeHref,
  onClose,
  children,
  wide = false,
  subtitle,
}: {
  title: string;
  closeHref?: string;
  onClose?: () => void;
  children: ReactNode;
  wide?: boolean;
  subtitle?: string;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  function dismiss() {
    if (onClose) onClose();
    else if (closeHref) router.push(closeHref, { scroll: false });
  }
  useAccountDialogBehavior(panelRef, dismiss);

  return (
    <div data-account-dialog-root className="fixed inset-0 z-50">
      {closeHref ? (
        <Link href={closeHref} scroll={false} aria-label="Close" className="absolute inset-0 bg-[#111a5a]/40" />
      ) : (
        <button type="button" aria-label="Close" className="absolute inset-0 bg-[#111a5a]/40" onClick={dismiss} />
      )}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`absolute inset-0 flex flex-col bg-white outline-none md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[min(90vh,840px)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[28px] md:shadow-[0_24px_80px_rgba(17,26,90,0.18)] ${
          wide ? "md:w-[min(920px,calc(100vw-48px))]" : "md:w-[min(640px,calc(100vw-48px))]"
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#EEF2F7] px-5 py-4">
          <div className="min-w-0">
            {subtitle ? <p className="text-xs font-semibold text-muted">{subtitle}</p> : null}
            <h2 id={titleId} className="font-display text-2xl font-bold text-indigo">
              {title}
            </h2>
          </div>
          {closeHref ? (
            <Link href={closeHref} scroll={false} aria-label="Close dialog" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-indigo hover:bg-lavender">
              ×
            </Link>
          ) : (
            <button type="button" onClick={dismiss} aria-label="Close dialog" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-indigo hover:bg-lavender">
              ×
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
