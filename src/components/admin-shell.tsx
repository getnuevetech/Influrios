"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { actionAdminLogout } from "@/app/admin/actions-auth";
import {
  IconBell,
  IconBriefcase,
  IconBuilding,
  IconCalendar,
  IconFileText,
  IconGrid,
  IconHome,
  IconIdCard,
  IconImage,
  IconMail,
  IconMegaphone,
  IconPlus,
  IconSearch,
  IconSettings,
  IconShieldPay,
  IconUser,
  IconUsers,
  IconWallet,
} from "@/components/icons";

export type AdminNavLink = {
  href: string;
  label: string;
  icon?: string;
};

export type AdminNavGroup = {
  name: string;
  links: AdminNavLink[];
};

const ICON_MAP: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  home: IconHome,
  banners: IconImage,
  value: IconMegaphone,
  homepage: IconGrid,
  collab: IconBriefcase,
  business: IconBuilding,
  faq: IconFileText,
  stats: IconCalendar,
  cards: IconIdCard,
  accounts: IconUser,
  bizAccounts: IconBuilding,
  invites: IconMail,
  access: IconSettings,
  agency: IconUsers,
  guests: IconUsers,
  billing: IconWallet,
  plans: IconShieldPay,
  default: IconGrid,
};

function NavIcon({ name }: { name?: string }) {
  const Icon = ICON_MAP[name || "default"] || ICON_MAP.default!;
  return <Icon size={16} className="shrink-0" />;
}

export function AdminTopBar({
  name,
  email,
  roleName,
}: {
  name: string;
  email: string;
  roleName: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("") || "AD";

  return (
    <header className="sticky top-0 z-40 border-b border-[#E4EBFF] bg-white/95 backdrop-blur-md">
      <div className="flex w-full items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-5 lg:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-display text-lg font-bold text-indigo">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full brand-gradient text-sm text-white shadow-md shadow-violet/25">
            ∞
          </span>
          <span className="hidden sm:inline">Influrios</span>
        </Link>

        <nav className="hidden items-center gap-4 text-[13px] font-medium text-muted xl:flex">
          <Link href="/" className="hover:text-indigo">
            Home
          </Link>
          <Link href="/discover" className="hover:text-indigo">
            Discover
          </Link>
          <Link href="/categories" className="hover:text-indigo">
            Categories
          </Link>
          <Link href="/collaboration" className="hover:text-indigo">
            Collaboration
          </Link>
          <Link href="/business" className="hover:text-indigo">
            For Businesses
          </Link>
          <Link href="/pricing" className="hover:text-indigo">
            Pricing
          </Link>
        </nav>

        <form action="/admin/accounts" method="get" className="mx-auto hidden min-w-0 max-w-xl flex-1 md:block">
          <input type="hidden" name="tab" value="all" />
          <label className="relative block">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
              <IconSearch size={16} />
            </span>
            <input
              name="q"
              type="search"
              placeholder="Search Influrios (users, businesses, campaigns, invoices...)"
              className="w-full rounded-full border border-[#E4EBFF] bg-[#F7F9FF] py-2 pl-9 pr-4 text-[13px] text-indigo outline-none ring-violet/30 placeholder:text-muted/80 focus:border-violet focus:bg-white focus:ring-2"
            />
          </label>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-lavender/50 hover:text-indigo"
            aria-label="Notifications"
          >
            <IconBell size={18} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-violet" />
          </button>

          <div className="hidden items-center gap-2 rounded-full border border-[#E4EBFF] bg-white py-1 pl-1 pr-3 sm:flex">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet to-blue text-[11px] font-bold text-white">
              {initials}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[12px] font-semibold text-indigo">{name}</p>
              <p className="truncate text-[10px] text-muted">{email}</p>
            </div>
            <span className="text-[10px] text-muted" aria-hidden>
              ▾
            </span>
          </div>

          <Link
            href="/admin/banners"
            className="inline-flex items-center gap-1.5 rounded-full bg-blue px-3.5 py-2 text-[12px] font-semibold text-white shadow-sm shadow-blue/25 hover:bg-[#1f6aef]"
          >
            <IconPlus size={14} />
            <span className="hidden sm:inline">Create</span>
          </Link>
        </div>
      </div>
      <p className="sr-only">
        Signed in as {roleName} ({email})
      </p>
    </header>
  );
}

export function AdminSidebar({
  groups,
  roleName,
}: {
  groups: AdminNavGroup[];
  roleName: string;
}) {
  const pathname = usePathname() || "/admin";
  const searchParams = useSearchParams();

  return (
    <aside className="sticky top-[57px] flex h-[calc(100vh-57px)] w-[240px] shrink-0 flex-col border-r border-[#E4EBFF] bg-white">
      <div className="border-b border-[#E4EBFF] px-4 py-4">
        <Link href="/admin" className="font-display text-[15px] font-bold text-indigo">
          Influrios Admin
        </Link>
        <p className="mt-1 truncate text-[11px] text-muted">{roleName} · Platform Control</p>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        {groups.map((group) => (
          <div key={group.name}>
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
              {group.name}
            </p>
            <div className="space-y-0.5">
              {group.links.map((item) => {
                const itemUrl = new URL(item.href, "https://influrios.local");
                const itemTab = itemUrl.searchParams.get("tab");
                const currentTab = searchParams?.get("tab");
                let active = false;
                if (item.href === "/admin") {
                  active = pathname === "/admin";
                } else if (itemTab) {
                  active = pathname === itemUrl.pathname && currentTab === itemTab;
                } else if (itemUrl.pathname === "/admin/accounts") {
                  active = pathname === "/admin/accounts" && !currentTab;
                } else {
                  active =
                    pathname === itemUrl.pathname || pathname.startsWith(`${itemUrl.pathname}/`);
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition ${
                      active
                        ? "bg-[#EEE8FF] text-violet"
                        : "text-indigo/75 hover:bg-[#F3F6FF] hover:text-violet"
                    }`}
                  >
                    <NavIcon name={item.icon} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="space-y-2 border-t border-[#E4EBFF] px-3 py-3 text-[12px] text-muted">
        <Link href="/" className="block font-semibold text-violet hover:underline">
          ← View site
        </Link>
        <form action={actionAdminLogout}>
          <button
            type="submit"
            className="w-full rounded-lg border border-[#E4EBFF] bg-white px-3 py-2 text-left text-[12px] font-semibold text-muted hover:text-indigo"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}

export function AdminShell({
  topBar,
  sidebar,
  children,
}: {
  topBar: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F5F8FF]">
      {topBar}
      <div className="flex min-h-[calc(100vh-57px)]">
        {sidebar}
        <div className="min-w-0 flex-1 overflow-x-auto">
          <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
