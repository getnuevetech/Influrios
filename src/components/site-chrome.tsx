import Link from "next/link";
import {
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
  { href: "/#categories", label: "Categories" },
  { href: "/collaboration", label: "Collaboration" },
  { href: "/business", label: "For Businesses" },
  { href: "/card#pricing", label: "Pricing" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[90rem] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold text-indigo">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full brand-gradient text-sm text-white shadow-md shadow-violet/30">
            ∞
          </span>
          Influrios
        </Link>
        <nav className="hidden items-center gap-5 text-sm font-medium text-muted lg:flex">
          {NAV.map((item) => (
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
          <Link href="/claim" className="btn-primary !px-4 !py-2 text-sm">
            Sign Up →
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-0 border-t border-white/10 bg-pro text-white">
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
            <li>
              <Link href="/">Home</Link>
            </li>
            <li>
              <Link href="/discover">Discover</Link>
            </li>
            <li>
              <Link href="/collaboration">Collaboration</Link>
            </li>
            <li>
              <Link href="/card">Influencer Card</Link>
            </li>
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
