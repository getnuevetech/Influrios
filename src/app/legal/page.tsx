import Link from "next/link";
import { LEGAL_CATEGORIES } from "@/lib/legal-catalog";
import { currentLegalDocuments } from "@/lib/legal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Legal Center" };

export default async function LegalCenterPage() {
  const docs = await currentLegalDocuments().catch(() => new Map());
  const published = [...docs.values()];

  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet">Influrios</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-indigo">Legal Center</h1>
      <p className="mt-3 text-sm text-muted">
        Each terms document and policy is published on its own page. The internal master pack is not published here.
      </p>
      <div className="mt-8 space-y-8">
        {LEGAL_CATEGORIES.map((category) => {
          const items = published.filter((doc) => doc.category === category.id);
          if (!items.length) return null;
          return (
            <section key={category.id}>
              <h2 className="font-display text-xl font-bold text-indigo">{category.label}</h2>
              <ul className="mt-3 space-y-2">
                {items.map((doc) => (
                  <li key={doc.documentKey}>
                    <Link href={`/legal/${doc.documentKey}`} className="font-semibold text-violet hover:underline">
                      {doc.title}
                    </Link>
                    <p className="text-xs text-muted">
                      Version {doc.version} · effective {doc.effectiveDate.toISOString().slice(0, 10)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
