import Link from "next/link";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/discover", label: "Discover" },
  { href: "/collaboration", label: "Collaboration" },
  { href: "/business", label: "Business" },
  { href: "/card", label: "Influencer Card" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold text-indigo">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full brand-gradient text-sm text-white">
            ∞
          </span>
          Influrios
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-indigo">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/claim" className="hidden text-sm font-semibold text-indigo sm:inline">
            Log in
          </Link>
          <Link href="/claim" className="btn-primary !px-4 !py-2 text-sm">
            Create Your Card
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-white/10 bg-pro text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <div className="font-display text-lg font-bold">Influrios</div>
          <p className="mt-2 text-sm text-white/70">Influence. Identity. Opportunity.</p>
        </div>
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-white/50">Platform</div>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li><Link href="/discover">Discover</Link></li>
            <li><Link href="/collaboration">Collaboration</Link></li>
            <li><Link href="/business">Business</Link></li>
            <li><Link href="/card">Influencer Card</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-white/50">For businesses</div>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li><Link href="/discover">Find creators</Link></li>
            <li><Link href="/business">Business workspace</Link></li>
            <li><Link href="/business#pricing">Business Pro</Link></li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-white/50">Company</div>
          <ul className="mt-3 space-y-2 text-sm text-white/80">
            <li><a href="mailto:hello@influrios.com">Contact</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} Influrios. All rights reserved.
      </div>
    </footer>
  );
}
