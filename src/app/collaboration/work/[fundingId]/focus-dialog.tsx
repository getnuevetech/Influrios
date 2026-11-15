"use client";

import { useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAccountDialogBehavior } from "@/components/account-dialog";

export function FocusDialog({ closeHref, children }: { closeHref: string; children: ReactNode }) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  useAccountDialogBehavior(panelRef, () => router.push(closeHref, { scroll: false }));
  return (
    <div data-account-dialog-root className="fixed inset-0 z-50">
      <a href={closeHref} data-keep-scroll aria-label="Close" className="absolute inset-0 bg-[#111a5a]/45" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-focus-title"
        className="absolute left-1/2 top-1/2 z-10 max-h-[calc(100vh-48px)] w-[min(32rem,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl outline-none"
      >
        {children}
      </div>
    </div>
  );
}
