"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Overview", match: (p: string) => p === "/dashboard" },
  {
    href: "/dashboard/details",
    label: "Profile Details",
    match: (p: string) => p.startsWith("/dashboard/details"),
  },
  {
    href: "/dashboard/preferences",
    label: "Opportunities & Preferences",
    match: (p: string) => p.startsWith("/dashboard/preferences"),
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
    <nav
      className="flex gap-1 overflow-x-auto rounded-2xl border border-[#E4EBFF] bg-white p-1 shadow-sm"
      aria-label="Profile sections"
    >
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`whitespace-nowrap rounded-xl px-3.5 py-2 text-[13px] font-semibold transition ${
              active
                ? "bg-[#EEE8FF] text-violet"
                : "text-muted hover:bg-[#F7F9FF] hover:text-indigo"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
