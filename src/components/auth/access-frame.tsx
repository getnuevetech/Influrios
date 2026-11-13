import Link from "next/link";

const DEFAULT_NAV = [
  { href: "/discover", label: "Features" },
  { href: "/discover", label: "Creators" },
  { href: "/business", label: "Brands" },
  { href: "/faq", label: "Help" },
];

export function AccountAccessFrame({
  actionHref,
  actionLabel,
  children,
}: {
  actionHref: string;
  actionLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F6F4FF]">
      <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold text-[#1B1464]">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full brand-gradient text-sm text-white">∞</span>
          Influrios
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-[#5C657F] md:flex">
          {DEFAULT_NAV.map((item) => (
            <Link key={item.label} href={item.href} className="hover:text-[#1B1464]">
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href={actionHref} className="text-sm font-semibold text-[#6D4AFF]">
          {actionLabel}
        </Link>
      </header>
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-6 lg:grid-cols-2 lg:px-8">{children}</div>
    </div>
  );
}
