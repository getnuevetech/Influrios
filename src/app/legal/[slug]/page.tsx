import Link from "next/link";
import { notFound } from "next/navigation";
import { currentLegalDocument } from "@/lib/legal";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const doc = await currentLegalDocument(slug).catch(() => null);
  return { title: doc ? `${doc.title} · Influrios` : "Legal" };
}

export default async function LegalDocumentPage({ params }: Props) {
  const { slug } = await params;
  const doc = await currentLegalDocument(slug).catch(() => null);
  if (!doc) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <Link href="/legal" className="text-sm font-semibold text-violet hover:underline">
        ← Legal Center
      </Link>
      <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-violet">
        Version {doc.version} · effective {doc.effectiveDate.toISOString().slice(0, 10)}
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold text-indigo">{doc.title}</h1>
      <article className="mt-6 whitespace-pre-wrap text-sm leading-6 text-indigo">{doc.bodyText}</article>
    </div>
  );
}
