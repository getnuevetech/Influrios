import Link from "next/link";
import { FAQ_AUDIENCE_LABELS, FAQ_AUDIENCES, isFaqAudience, type FaqAudience } from "@/lib/faq-catalog";
import { listPublishedFaq } from "@/lib/faq";

export const dynamic = "force-dynamic";
export const metadata = { title: "FAQ" };

type Props = { searchParams: Promise<{ audience?: string }> };

export default async function FaqPage({ searchParams }: Props) {
  const params = await searchParams;
  const audience: FaqAudience | undefined = params.audience && isFaqAudience(params.audience) ? params.audience : undefined;
  let entries: Awaited<ReturnType<typeof listPublishedFaq>> = [];
  let unavailable = false;
  try {
    entries = await listPublishedFaq(audience);
  } catch (error) {
    console.error("faq", error);
    unavailable = true;
  }
  const groups = FAQ_AUDIENCES.map((key) => ({
    key,
    label: FAQ_AUDIENCE_LABELS[key],
    entries: entries.filter((entry) => entry.audience === key),
  })).filter((group) => (audience ? group.key === audience : group.entries.length > 0));

  return (
    <div className="bg-[#F7FAFF]">
      <section className="hero-atmosphere text-white">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lavender/80">Help</p>
          <h1 className="mt-2 font-display text-4xl font-bold">FAQ</h1>
          <p className="mt-3 text-white/75">
            Answers for visitors, creators, businesses, and agencies. Plans and features are configured by Influrios, so a screen follows the plan on the account.
          </p>
        </div>
      </section>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <nav className="flex flex-wrap gap-2">
          <Link href="/faq" className={`rounded-full px-3 py-1 text-sm font-semibold ${audience ? "bg-white text-indigo" : "bg-indigo text-white"}`}>
            All
          </Link>
          {FAQ_AUDIENCES.map((key) => (
            <Link
              key={key}
              href={`/faq?audience=${key}`}
              className={`rounded-full px-3 py-1 text-sm font-semibold ${audience === key ? "bg-indigo text-white" : "bg-white text-indigo"}`}
            >
              {FAQ_AUDIENCE_LABELS[key]}
            </Link>
          ))}
        </nav>
        {unavailable ? <p className="mt-6 text-sm text-amber-800">The FAQ is unavailable right now.</p> : null}
        <div className="mt-8 space-y-10">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="font-display text-2xl font-bold text-indigo">{group.label}</h2>
              <div className="mt-4 space-y-3">
                {group.entries.map((entry) => (
                  <article key={entry.id} id={entry.key} className="card-surface scroll-mt-24 p-5">
                    <h3 className="font-display text-lg font-bold text-indigo">{entry.question}</h3>
                    <div className="mt-3 space-y-3 text-sm leading-6 text-indigo/80">
                      {entry.answer.split(/\n\n+/).map((paragraph) => (
                        <p key={paragraph.slice(0, 40)} className="whitespace-pre-wrap">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
