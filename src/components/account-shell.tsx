import Link from "next/link";
import { headers } from "next/headers";
import { getAccountSession } from "@/lib/accounts";
import { getWorkspace } from "@/lib/business";

const CREATOR_NAV = [
  { href: "/creator", label: "Home" },
  { href: "/dashboard", label: "My Profile" },
  { href: "/collaboration/hub", label: "Collaborations" },
  { href: "/mentorship", label: "Mentorship" },
  { href: "/billing", label: "Billing & Plan" },
  { href: "/account", label: "Settings" },
];

const BUSINESS_NAV = [
  { href: "/business/home", label: "Dashboard" },
  { href: "/discover", label: "Discover Creators" },
  { href: "/collaboration/business", label: "Requests" },
  { href: "/collaboration/records", label: "Collaborations" },
  { href: "/business/intelligence", label: "Analytics" },
  { href: "/business/billing", label: "Billing & Plans" },
  { href: "/account", label: "Settings" },
];

function active(href: string, path: string) {
  if (href === "/creator" || href === "/business/home") return path === href;
  return path === href || path.startsWith(`${href}/`);
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
  let name = account?.name || account?.email || "Account";
  let role = audience === "business" ? "Business workspace" : "Influencer";
  if (audience === "business" && account) {
    const workspace = await getWorkspace(account.id).catch(() => null);
    if (workspace?.name) name = workspace.name;
  }
  const nav = audience === "business" ? BUSINESS_NAV : CREATOR_NAV;
  const home = audience === "business" ? "/business/home" : "/creator";
  const other = audience === "business" ? { href: "/creator", label: "Influencer account" } : { href: "/business/home", label: "Business account" };

  return (
    <div className="flex min-h-screen bg-[#F4F7FB] text-indigo">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-[#E6ECF7] bg-white lg:flex">
        <Link href={home} className="flex items-center gap-2 px-5 py-5 font-display text-lg font-bold">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full brand-gradient text-sm text-white">∞</span>
          Influrios
        </Link>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((item) => {
            const on = active(item.href, path);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-xl px-3 py-2.5 text-sm font-semibold ${on ? "bg-[#F1ECFF] text-violet" : "text-[#4E5872] hover:bg-[#F7F8FC]"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[#E6ECF7] p-4 text-xs text-muted">
          <Link href={other.href} className="font-semibold text-violet hover:underline">
            {other.label}
          </Link>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[#E6ECF7] bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <form action="/discover" className="hidden min-w-0 flex-1 md:block">
            <input
              name="q"
              placeholder={audience === "business" ? "Search creators, campaigns, or anything..." : "Search creators or collaborations..."}
              className="w-full max-w-xl rounded-full border border-[#E6ECF7] bg-[#F7F9FD] px-4 py-2 text-sm outline-none focus:border-violet"
            />
          </form>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-bold leading-tight">{name}</p>
              <p className="text-[11px] text-muted">{role}</p>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#EDE7FF] text-sm font-bold text-violet">
              {name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b border-[#E6ECF7] bg-white px-3 py-2 lg:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${active(item.href, path) ? "bg-[#F1ECFF] text-violet" : "text-[#4E5872]"}`}
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
