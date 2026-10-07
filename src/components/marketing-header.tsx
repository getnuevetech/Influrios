import Link from "next/link";

export function MarketingHeader({
  active,
  signedIn,
}: {
  active: "influencer" | "business";
  signedIn: boolean;
}) {
  const links = [
    { href: "/discover", label: "Discover" },
    { href: "/pricing", label: "Influencer Plans", key: "influencer" as const },
    { href: "/business/plans", label: "Business Plans", key: "business" as const },
    { href: "/faq", label: "Resources" },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-[#E6ECF7] bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[90rem] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold text-indigo">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full brand-gradient text-sm text-white">∞</span>
          Influrios
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-[#5C657F] md:flex">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={item.key === active ? "text-indigo underline decoration-violet decoration-2 underline-offset-8" : "hover:text-indigo"}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link href={active === "business" ? "/business/home" : "/creator"} className="text-sm font-semibold text-indigo">
              Your account
            </Link>
          ) : (
            <Link href="/login" className="rounded-full px-4 py-2 text-sm font-semibold text-indigo hover:bg-[#F4F0FF]">
              Login
            </Link>
          )}
          <Link href={active === "business" ? "/login?next=/business/home" : "/claim"} className="btn-primary !px-4 !py-2 text-sm">
            {active === "business" ? "Start Free" : "Get Started"}
          </Link>
        </div>
      </div>
    </header>
  );
}
