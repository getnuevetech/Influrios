import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  IconBell,
  IconBookmark,
  IconBriefcase,
  IconBuilding,
  IconCrown,
  IconGrid,
  IconHandshake,
  IconHome,
  IconIdCard,
  IconImage,
  IconIntelligence,
  IconMail,
  IconSearch,
  IconSettings,
  IconShieldPay,
  IconUser,
  IconUsers,
  IconWallet,
} from "@/components/icons";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";
import { prisma } from "@/lib/db";
import { isPlanCode, planLabel, type PlanCode } from "@/lib/entitlements";

type NavItem = { href: string; label: string; icon: ReactNode };

const CREATOR_NAV: NavItem[] = [
  { href: "/creator", label: "Home", icon: <IconHome size={18} /> },
  { href: "/dashboard", label: "My Profile", icon: <IconUser size={18} /> },
  { href: "/collaboration/hub", label: "Opportunities", icon: <IconBriefcase size={18} /> },
  { href: "/collaboration/hub#pipeline", label: "Collaborations", icon: <IconHandshake size={18} /> },
  { href: "/creator/media-kit", label: "Media Kit", icon: <IconImage size={18} /> },
  { href: "/creator/analytics", label: "Analytics", icon: <IconIntelligence size={18} /> },
  { href: "/creator/messages", label: "Messages", icon: <IconMail size={18} /> },
  { href: "/creator/earnings", label: "Earnings", icon: <IconWallet size={18} /> },
  { href: "/billing#payouts", label: "Payout Methods", icon: <IconShieldPay size={18} /> },
  { href: "/billing", label: "Billing & Plan", icon: <IconIdCard size={18} /> },
  { href: "/mentorship", label: "Mentorship", icon: <IconUsers size={18} /> },
  { href: "/account", label: "Settings", icon: <IconSettings size={18} /> },
];

const BUSINESS_NAV: NavItem[] = [
  { href: "/business/home", label: "Dashboard", icon: <IconHome size={18} /> },
  { href: "/business/profile", label: "Company Profile", icon: <IconBuilding size={18} /> },
  { href: "/discover", label: "Discover Creators", icon: <IconSearch size={18} /> },
  { href: "/collaboration/business#shortlist", label: "Saved Creators", icon: <IconBookmark size={18} /> },
  { href: "/collaboration/business", label: "Requests", icon: <IconBriefcase size={18} /> },
  { href: "/collaboration/business#suggestions", label: "Collaboration Opportunities", icon: <IconGrid size={18} /> },
  { href: "/collaboration/records", label: "Active Collaborations", icon: <IconHandshake size={18} /> },
  { href: "/business/intelligence", label: "Analytics", icon: <IconIntelligence size={18} /> },
  { href: "/collaboration/team", label: "Team", icon: <IconUsers size={18} /> },
  { href: "/business/billing", label: "Billing & Plans", icon: <IconIdCard size={18} /> },
  { href: "/payments", label: "Collaboration Payments", icon: <IconShieldPay size={18} /> },
  { href: "/account", label: "Settings", icon: <IconSettings size={18} /> },
];

const PLAN_ORDER: PlanCode[] = ["STARTER", "PLUS", "PRO"];

function nextCreatorUpgrade(plan: string): { code: PlanCode; label: string; blurb: string } | null {
  const current = isPlanCode(plan) ? plan : "STARTER";
  const index = PLAN_ORDER.indexOf(current);
  if (index < 0 || index >= PLAN_ORDER.length - 1) return null;
  const code = PLAN_ORDER[index + 1]!;
  if (code === "PLUS") {
    return { code, label: "Upgrade to Plus", blurb: "Unlock short links, QR, and richer card tools." };
  }
  return { code, label: "Upgrade to Pro", blurb: "Dynamic destinations, deeper analytics, and priority tools." };
}

function active(href: string, path: string) {
  const base = href.split("#")[0]!;
  if (base === "/creator" || base === "/business/home") return path === base;
  return path === base || path.startsWith(`${base}/`);
}

export async function MemberFrame({
  audience,
  children,
}: {
  audience: "creator" | "business";
  children: React.ReactNode;
}) {
  const path = (await headers()).get("x-pathname") ?? "";
  const account = await getAccountSession().catch(() => null);
  if (account && !account.hasPassword && !path.startsWith("/account/password")) {
    redirect(
      `/account/password?next=${encodeURIComponent(path || (audience === "business" ? "/business/home" : "/creator"))}`,
    );
  }
  const name = account?.name || account?.email || "Account";
  let company = "";
  let creatorPlan = "STARTER";
  if (audience === "business" && account) {
    const workspace = await getWorkspace(account.id).catch(() => null);
    if (workspace?.name) company = workspace.name;
  }
  if (audience === "creator" && account) {
    const [user, creator] = await Promise.all([
      prisma.user.findUnique({ where: { id: account.id }, select: { planTier: true } }).catch(() => null),
      prisma.creator.findUnique({ where: { userId: account.id }, select: { planTier: true } }).catch(() => null),
    ]);
    creatorPlan = creator?.planTier || user?.planTier || "STARTER";
  }
  const upgrade = audience === "creator" ? nextCreatorUpgrade(creatorPlan) : null;
  const nav = audience === "business" ? BUSINESS_NAV : CREATOR_NAV;
  const home = audience === "business" ? "/business/home" : "/creator";
  const other =
    audience === "business"
      ? { href: "/creator", label: "Influencer account" }
      : { href: "/business/home", label: "Business account" };
  const searchPlaceholder =
    audience === "business"
      ? "Search creators, campaigns, or anything..."
      : "Search opportunities, brands, or anything...";

  return (
    <div className="flex min-h-screen bg-[#F5F7FB] text-indigo">
      <aside className="sticky top-0 hidden h-screen w-[15.5rem] shrink-0 flex-col border-r border-[#E6ECF7] bg-white lg:flex">
        <Link href={home} className="flex shrink-0 items-center gap-2 px-5 py-5 font-display text-lg font-bold">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full brand-gradient text-sm text-white">
            ∞
          </span>
          Influrios
        </Link>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
          {nav.map((item) => {
            const on = active(item.href, path);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                  on ? "bg-[#F1ECFF] text-violet" : "text-[#4E5872] hover:bg-[#F7F8FC]"
                }`}
              >
                {on ? <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-violet" /> : null}
                <span className={on ? "text-violet" : "text-[#8A93A8]"}>{item.icon}</span>
                <span className="truncate">{item.label}</span>
                {item.href === "/creator/messages" ? (
                  <span className="ml-auto h-2 w-2 rounded-full bg-rose-500" aria-hidden />
                ) : null}
              </Link>
            );
          })}
        </nav>
        {upgrade ? (
          <div className="mx-3 mb-2 shrink-0 rounded-2xl bg-gradient-to-br from-[#6D5EF7] to-[#8B5CF6] p-3 text-white shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <IconCrown size={16} />
              {upgrade.label}
            </div>
            <p className="mt-1 text-[11px] leading-snug text-white/85">{upgrade.blurb}</p>
            <p className="mt-1 text-[10px] text-white/70">Current: {planLabel(creatorPlan)}</p>
            <Link
              href="/billing"
              className="mt-2 inline-flex items-center justify-center rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#5B4FE0] hover:bg-[#F5F3FF]"
              style={{ color: "#5B4FE0" }}
            >
              Upgrade now
            </Link>
          </div>
        ) : audience === "creator" ? (
          <div className="mx-3 mb-2 shrink-0 rounded-2xl border border-[#E6ECF7] bg-[#F8F6FF] px-3 py-2.5 text-xs font-semibold text-violet">
            You’re on {planLabel(creatorPlan)}
          </div>
        ) : null}
        <div className="shrink-0 border-t border-[#E6ECF7] p-4 text-[11px] text-muted">
          <Link href={other.href} className="font-semibold text-violet hover:underline">
            {other.label}
          </Link>
          <p className="mt-2">© {new Date().getFullYear()} Influrios. All rights reserved.</p>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[#E6ECF7] bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <form action="/discover" className="hidden min-w-0 flex-1 md:block">
            <label className="relative block max-w-xl">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8A93A8]">
                <IconSearch size={16} />
              </span>
              <input
                name="q"
                placeholder={searchPlaceholder}
                className="w-full rounded-full border border-[#E6ECF7] bg-[#F7F9FD] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-violet"
              />
            </label>
          </form>
          <div className="ml-auto flex items-center gap-3">
            <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E6ECF7] text-[#4E5872]">
              <IconBell size={18} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
            </span>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#EDE7FF] text-sm font-bold text-violet">
                {name.slice(0, 1).toUpperCase()}
              </span>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-bold leading-tight">{name}</p>
                <p className="text-[11px] text-muted">{audience === "business" ? company || "Business workspace" : "Influencer"}</p>
              </div>
            </div>
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto border-b border-[#E6ECF7] bg-white px-3 py-2 lg:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                active(item.href, path) ? "bg-[#F1ECFF] text-violet" : "text-[#4E5872]"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}
