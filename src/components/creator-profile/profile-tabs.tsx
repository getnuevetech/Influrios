"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Overview", match: (p: string) => p === "/dashboard" },
  {
    href: "/dashboard/details",
    label: "Details & Preferences",
    match: (p: string) =>
      p.startsWith("/dashboard/details") || p.startsWith("/dashboard/preferences"),
  },
  {
    href: "/dashboard/social",
    label: "Social Accounts",
    match: (p: string) => p.startsWith("/dashboard/social"),
  },
  {
    href: "/dashboard/links",
    label: "Links & Payments",
    match: (p: string) => p.startsWith("/dashboard/links"),
  },
  {
    href: "/creator/media-kit",
    label: "Media Kit",
    match: (p: string) => p.startsWith("/creator/media-kit"),
  },
] as const;

export function CreatorProfileTabs() {
  const pathname = usePathname() || "/dashboard";
  return (
    <nav className="flex gap-5 overflow-x-auto border-b border-[#E6ECF7]" aria-label="Profile sections">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative whitespace-nowrap pb-3 text-[13px] font-semibold transition ${
              active ? "text-violet" : "text-muted hover:text-indigo"
            }`}
          >
            {tab.label}
            {active ? (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-violet" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
