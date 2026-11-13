"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

export function RecordDialog({
  title,
  closeHref,
  children,
  wide = true,
}: {
  title: string;
  closeHref: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const body = document.body;
    const overflow = body.style.overflow;
    body.style.overflow = "hidden";
    panelRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") router.push(closeHref, { scroll: false });
    }
    window.addEventListener("keydown", onKey);
    return () => {
      body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [closeHref, router]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-[#111a5a]/40" />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-record-title"
        className={`absolute inset-0 flex flex-col bg-white outline-none md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[calc(100vh-48px)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:shadow-xl ${
          wide ? "md:w-[min(1120px,calc(100vw-48px))]" : "md:w-[min(640px,calc(100vw-48px))]"
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#e4e9f5] px-4 py-4 sm:px-6">
          <h2 id="payment-record-title" className="font-display text-2xl font-bold text-indigo">
            {title}
          </h2>
          <Link
            href={closeHref}
            scroll={false}
            aria-label="Close"
            className="inline-flex h-11 min-w-11 items-center justify-center rounded-full text-indigo hover:bg-lavender"
          >
            ×
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
