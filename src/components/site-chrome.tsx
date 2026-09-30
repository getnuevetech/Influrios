import Link from "next/link";
import { getAccountSession } from "@/lib/accounts";
import { getDirectory } from "@/lib/directory";
import {
  IconBuilding,
  IconGrid,
  IconHandshake,
  IconHeart,
  IconIdCard,
  IconInstagram,
  IconLinkedIn,
  IconSearch,
  IconTikTok,
  IconX,
  IconYouTube,
} from "@/components/icons";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/discover", label: "Discover" },
  { href: "/categories", label: "Categories" },
  { href: "/collaboration", label: "Collaboration" },
  { href: "/business", label: "For Businesses" },
  { href: "/pricing", label: "Pricing" },
];

const FOOTER_PLATFORM = [
  { href: "/", label: "Home" },
  { href: "/discover", label: "Discover" },
  { href: "/collaboration", label: "Collaboration" },
  { href: "/card", label: "Influencer Card" },
];

const FOOTER_PILLARS = [
  { l: "Influrios Card", Icon: IconIdCard, tone: "bg-white/10 text-[#C4B5FD]" },
  { l: "Influence Intelligence", Icon: IconGrid, tone: "bg-white/10 text-[#93C5FD]" },
  { l: "Collaboration Network", Icon: IconHandshake, tone: "bg-white/10 text-[#C4B5FD]" },
  { l: "Protected Payments", Icon: IconBuilding, tone: "bg-white/10 text-[#93C5FD]" },
] as const;

export async function SiteHeader() {
  const directory = await getDirectory();
  const account = await getAccountSession().catch(() => null);
  const nav = directory.menus.filter((item) => item.menu === "header" && item.visible);
  const links = nav.length ? nav : NAV;
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[90rem] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8 xl:px-10">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold text-indigo">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full brand-gradient text-sm text-white shadow-md shadow-violet/30">
            ∞
          </span>
          Influrios
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-medium text-muted lg:flex">
          {links.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-indigo">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/discover"
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-lavender/60 hover:text-indigo"
            aria-label="Search"
          >
            <IconSearch size={18} />
          </Link>
          <Link
            href="/admin"
            className="hidden text-sm font-semibold text-muted hover:text-indigo sm:inline"
          >
            Admin
          </Link>
          {account ? (
            <Link href="/account" className="hidden text-sm font-semibold text-indigo sm:inline">
              {account.name?.split(" ")[0] || "Account"}
            </Link>
          ) : (
            <Link href="/login" className="hidden text-sm font-semibold text-indigo sm:inline">
              Log in
            </Link>
          )}
          <Link href="/claim" className="btn-primary !px-4 !py-2 text-sm">
            Sign Up →
          </Link>
        </div>
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const directory = await getDirectory();
  const platform = directory.menus.filter((item) => item.menu === "footer_platform" && item.visible);
  const platformLinks = platform.length ? platform : FOOTER_PLATFORM;
  return (
    <footer className="mt-0 border-t border-white/10 bg-pro text-white">
      {/* Value pillars — no placeholder scale statistics until figures are audited */}
      <div className="border-b border-white/10">
        <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-8 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
          <div className="grid flex-1 grid-cols-2 gap-8 sm:grid-cols-4">
            {FOOTER_PILLARS.map(({ l, Icon, tone }) => (
              <div key={l} className="flex flex-col items-center text-center">
                <span className={`mb-3 flex h-12 w-12 items-center justify-center rounded-full ${tone}`}>
                  <Icon size={22} />
                </span>
                <p className="font-display text-sm font-bold text-white sm:text-base">{l}</p>
              </div>
            ))}
          </div>
          <p className="shrink-0 text-center font-display text-sm italic text-[#C4B5FD] lg:max-w-[11rem] lg:text-right">
            Influence. Identity. Opportunity.{" "}
            <IconHeart size={12} className="inline text-pink" />
          </p>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[90rem] gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-5 lg:px-10">
        <div className="lg:col-span-1">
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full brand-gradient text-sm">
              ∞
            </span>
            Influrios
          </div>
          <p className="mt-3 text-sm text-white/70">Creators. Collaborations. Real Opportunities.</p>
          <div className="mt-5 flex items-center gap-3 text-white/80">
            <a href="https://instagram.com" aria-label="Instagram" className="hover:text-white">
              <IconInstagram size={18} />
            </a>
            <a href="https://tiktok.com" aria-label="TikTok" className="hover:text-white">
              <IconTikTok size={18} />
            </a>
            <a href="https://youtube.com" aria-label="YouTube" className="hover:text-white">
              <IconYouTube size={18} />
            </a>
            <a href="https://x.com" aria-label="X" className="hover:text-white">
              <IconX size={18} />
            </a>
            <a href="https://linkedin.com" aria-label="LinkedIn" className="hover:text-white">
              <IconLinkedIn size={18} />
            </a>
          </div>
        </div>
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-white/50">Platform</div>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            {platformLinks.map((item) => (
              <li key={item.href + item.label}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-white/50">For businesses</div>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li>
              <Link href="/discover">Find creators</Link>
            </li>
            <li>
              <Link href="/business">Business workspace</Link>
            </li>
            <li>
              <Link href="/agency">Agency workspace</Link>
            </li>
            <li>
              <Link href="/business/intelligence">Intelligence</Link>
            </li>
            <li>
              <Link href="/business#pricing">Business Pro</Link>
            </li>
            <li>
              <Link href="/collaboration">Opportunities</Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-white/50">Resources</div>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li>
              <Link href="/card">Pricing</Link>
            </li>
            <li>
              <Link href="/billing">Checkout</Link>
            </li>
            <li>
              <Link href="/payments">Protected payments</Link>
            </li>
            <li>
              <Link href="/trust">Trust &amp; disputes</Link>
            </li>
            <li>
              <Link href="/claim">Create your card</Link>
            </li>
            <li>
              <Link href="/discover">Categories</Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-white/50">Company</div>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li>
              <a href="mailto:hello@influrios.com">Contact</a>
            </li>
            <li>
              <a href="mailto:hello@influrios.com">About</a>
            </li>
            <li>
              <a href="mailto:hello@influrios.com">Privacy</a>
            </li>
            <li>
              <a href="mailto:hello@influrios.com">Terms</a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} Influrios. All rights reserved.
      </div>
    </footer>
  );
}
