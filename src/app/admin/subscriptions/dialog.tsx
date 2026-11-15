"use client";

import { useId, useRef, type ReactNode } from "react";
import { useAccountDialogBehavior } from "@/components/account-dialog";

export function SubscriptionsDialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useAccountDialogBehavior(panelRef, onClose);

  return (
    <div data-account-dialog-root className="fixed inset-0 z-50">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-[#111a5a]/40" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`absolute inset-x-4 top-1/2 max-h-[min(90vh,840px)] -translate-y-1/2 overflow-y-auto rounded-3xl bg-white p-5 shadow-[0_24px_80px_rgba(17,26,90,0.18)] outline-none sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 ${
          wide ? "sm:w-[min(760px,calc(100vw-48px))]" : "sm:w-[min(440px,calc(100vw-48px))]"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-display text-xl font-bold text-indigo">
            {title}
          </h2>
          <button type="button" aria-label="Close dialog" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-indigo hover:bg-lavender">
            ×
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
