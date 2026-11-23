"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

export type MobileNavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  badge: string;
  badgeCount: number;
  active: boolean;
};

/**
 * Signed-in mobile navigation (master-spec 6): a fixed four-slot bar, three destinations plus More.
 * It never scrolls sideways. More opens a drawer with every destination and its badge; its own badge is
 * the sum of badges for destinations not in the bar. A drawer page highlights More.
 */
export function MemberMobileNav({ primary, more }: { primary: MobileNavItem[]; more: MobileNavItem[] }) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const hiddenBadges = more.reduce((sum, item) => sum + item.badgeCount, 0);
  const moreActive = open || more.some((item) => item.active);

  useEffect(() => {
    if (!open) return;
    const first = panel.current?.querySelector<HTMLElement>("a,button");
    first?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
      if (event.key === "Tab" && panel.current) {
        const focusable = [...panel.current.querySelectorAll<HTMLElement>("a,button")];
        const firstEl = focusable[0];
        const lastEl = focusable[focusable.length - 1];
        if (!firstEl || !lastEl) return;
        if (event.shiftKey && document.activeElement === firstEl) {
          event.preventDefault();
          lastEl.focus();
        } else if (!event.shiftKey && document.activeElement === lastEl) {
          event.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const cell = "relative flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 text-[10px] font-semibold tracking-tight min-[360px]:text-[11px]";
  const badge = (text: string) =>
    text ? (
      <span className="absolute right-[18%] top-0.5 rounded-full bg-[#6D4AFF] px-1.5 text-[10px] font-bold leading-4 text-white">{text}</span>
    ) : null;

  return (
    <>
      <nav aria-label="Main" className="sticky top-[65px] z-20 grid grid-cols-4 border-b border-[#E6ECF7] bg-white lg:hidden">
        {primary.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={`${cell} ${item.active ? "text-violet" : "text-[#4E5872]"}`}
          >
            <span className={item.active ? "text-violet" : "text-[#8A93A8]"}>{item.icon}</span>
            <span className="w-full truncate text-center">{item.label}</span>
            {badge(item.badge)}
          </Link>
        ))}
        <button
          ref={button}
          type="button"
          aria-expanded={open}
          aria-controls="member-more-drawer"
          onClick={() => setOpen((value) => !value)}
          className={`${cell} ${moreActive ? "text-violet" : "text-[#4E5872]"}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
          <span>More</span>
          {badge(hiddenBadges > 0 ? (hiddenBadges > 9 ? "9+" : String(hiddenBadges)) : "")}
        </button>
      </nav>
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="More">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div
            id="member-more-drawer"
            ref={panel}
            className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-3 shadow-xl"
          >
            <div className="mb-2 flex items-center justify-between px-2">
              <p className="text-sm font-bold text-indigo">More</p>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full px-3 py-1 text-sm font-semibold text-violet">
                Close
              </button>
            </div>
            <ul className="space-y-1">
              {[...primary, ...more].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={item.active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${
                      item.active ? "bg-[#F1ECFF] text-violet" : "text-[#4E5872]"
                    }`}
                  >
                    <span className={item.active ? "text-violet" : "text-[#8A93A8]"}>{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="ml-auto rounded-full bg-[#6D4AFF] px-1.5 text-[10px] font-bold text-white">{item.badge}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
