import Link from "next/link";
import {
  IconIdCard,
  IconIntelligence,
  IconNetwork,
  IconShieldPay,
} from "@/components/icons";
import type { ValuePropositionStrip } from "@/lib/cms";

const ICONS = {
  card: IconIdCard,
  intelligence: IconIntelligence,
  network: IconNetwork,
  payments: IconShieldPay,
} as const;

const ACCENT: Record<string, string> = {
  violet: "bg-lavender text-violet",
  blue: "bg-[#D9E8FF] text-blue",
  rose: "bg-[#F3E8FF] text-violet",
  emerald: "bg-emerald-50 text-emerald-700",
};

export function HomepageValuePropositionStrip({
  strip,
}: {
  strip: ValuePropositionStrip;
}) {
  if (!strip.enabled) return null;

  const items = [...strip.items]
    .filter((i) => i.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (!items.length) return null;

  return (
    <section
      className="relative w-full overflow-hidden border-y border-border bg-white py-10"
      data-analytics="homepage_value_proposition_strip"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(ellipse_at_right,_rgba(99,60,255,0.12),_transparent_70%)]"
      />
      <div className="relative mx-auto max-w-[90rem] px-4 sm:px-6 lg:px-10">
        <div className="mb-8 max-w-2xl text-center sm:text-left">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet">
            {strip.eyebrow}
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold text-indigo sm:text-3xl">
            {strip.headline}{" "}
            {strip.headlineHighlight ? (
              <span className="brand-gradient-text">{strip.headlineHighlight}</span>
            ) : null}
          </h2>
          {strip.subtitle ? (
            <p className="mt-2 text-sm text-muted sm:text-base">{strip.subtitle}</p>
          ) : null}
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
          {items.map((item, i) => {
            const Icon = ICONS[item.iconKey] ?? IconIdCard;
            const tone = ACCENT[item.accentToken] ?? ACCENT.violet;
            return (
              <Link
                key={item.key}
                href={item.linkUrl || "/"}
                className={`flex flex-col items-center gap-3 text-center transition hover:-translate-y-0.5 ${
                  i < items.length - 1 || items.length < 4
                    ? "xl:border-r xl:border-[#E8ECF5] xl:pr-5"
                    : ""
                }`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}
                >
                  <Icon size={22} />
                </span>
                <div>
                  <h3 className="font-display text-base font-bold text-indigo">{item.title}</h3>
                  <p className="mt-1 text-sm leading-snug text-muted">{item.description}</p>
                  {item.microLabel ? (
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-violet">
                      {item.microLabel}
                    </p>
                  ) : null}
                </div>
              </Link>
            );
          })}

          <div className="flex flex-col items-center justify-center border-t border-[#E8ECF5] pt-5 text-center md:col-span-2 xl:col-span-1 xl:border-t-0 xl:pl-5 xl:pt-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
              {strip.closingTaglineLine1}
            </p>
            <p className="mt-2 font-display text-xl font-bold leading-tight brand-gradient-text sm:text-2xl">
              {strip.closingTaglineLine2}
            </p>
            <span
              aria-hidden
              className="mt-3 h-1 w-12 rounded-full bg-gradient-to-r from-[#633CFF] to-[#2979FF]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
