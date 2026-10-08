import Link from "next/link";
import { getAccountSession } from "@/lib/accounts";
import { getDirectory } from "@/lib/directory";
import { rethrowIfNextDynamicError } from "@/lib/next-dynamic";
import { getFooterStrip, type FooterIconKey, type FooterTone } from "@/lib/site-config";
import {
  IconBuilding,
  IconHandshake,
  IconHeart,
  IconInstagram,
  IconLinkedIn,
  IconSearch,
  IconTikTok,
  IconUser,
  IconUsers,
  IconX,
  IconYouTube,
} from "@/components/icons";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/discover", label: "Discover Influencers" },
  { href: "/categories", label: "Categories" },
  { href: "/collaboration", label: "Collaborations" },
  { href: "/business", label: "For Businesses" },
  { href: "/pricing", label: "Pricing" },
];

const FOOTER_PLATFORM = [
  { href: "/", label: "Home" },
  { href: "/discover", label: "Discover" },
  { href: "/collaboration", label: "Collaborations" },
  { href: "/card", label: "Influencer Card" },
];

const STAT_ICONS: Record<FooterIconKey, typeof IconUser> = {
  user: IconUser,
  users: IconUsers,
  handshake: IconHandshake,
  building: IconBuilding,
};

const STAT_TONES: Record<FooterTone, string> = {
  violet: "bg-[#EDE7FF] text-[#633CFF]",
  sky: "bg-[#E3F4FF] text-[#3B82F6]",
  blue: "bg-[#E7EEFF] text-[#2979FF]",
};

export async function SiteHeader() {
  let links: { href: string; label: string }[] = NAV;
  try {
    const directory = await getDirectory();
    const nav = directory.menus.filter((item) => item.menu === "header" && item.visible);
    if (nav.length) links = nav;
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error("site header", error);
  }
  const account = await getAccountSession().catch(() => null);
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
            Join Influrios →
          </Link>
        </div>
      </div>
    </header>
  );
}

export async function SiteFooter() {
  let platformLinks: { href: string; label: string }[] = FOOTER_PLATFORM;
  let strip: Awaited<ReturnType<typeof getFooterStrip>> = { stats: [], tagline: "" };
  try {
    const [directory, loaded] = await Promise.all([getDirectory(), getFooterStrip()]);
    const platform = directory.menus.filter((item) => item.menu === "footer_platform" && item.visible);
    if (platform.length) platformLinks = platform;
    strip = loaded;
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error("site footer", error);
  }
  return (
    <footer className="mt-0 border-t border-white/10 bg-pro text-white">
      {strip.stats.length ? (
        <div className="border-b border-white/10">
          <div className="mx-auto flex w-full max-w-[90rem] flex-col items-center gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-10">
            <div className="grid w-full flex-1 grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {strip.stats.map((stat) => {
                const Icon = STAT_ICONS[stat.iconKey];
                return (
                  <div key={stat.key} className="flex items-center gap-3">
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${STAT_TONES[stat.tone]}`}
                    >
                      <Icon size={22} />
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-xl font-bold leading-none text-white">{stat.value}</p>
                      <p className="mt-1 text-xs text-white/70">{stat.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="shrink-0 text-center font-script text-[1.65rem] font-semibold leading-tight text-[#E7DEFF] lg:max-w-[11rem] lg:text-right">
              <span aria-hidden className="mr-1 text-lg">
                ✦
              </span>
              {strip.tagline} <IconHeart size={14} className="inline text-pink" />
            </p>
          </div>
        </div>
      ) : null}

      <div className="mx-auto grid w-full max-w-[90rem] gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-5 lg:px-10">
        <div className="lg:col-span-1">
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full brand-gradient text-sm">
              ∞
            </span>
            Influrios
          </div>
          <p className="mt-3 text-sm text-white/70">Influencers. Collaborations. Real Opportunities.</p>
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
              <Link href="/discover">Find Influencers</Link>
            </li>
            <li>
              <Link href="/business" className="font-semibold text-violet hover:underline">
                For Businesses
              </Link>
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
              <Link href="/faq">FAQ</Link>
            </li>
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
              <Link href="/legal/privacy-policy">Privacy</Link>
            </li>
            <li>
              <Link href="/legal/terms-of-service">Terms</Link>
            </li>
            <li>
              <Link href="/legal">Legal Center</Link>
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
