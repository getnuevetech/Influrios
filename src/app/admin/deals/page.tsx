import Link from "next/link";
import { requireAnyAdminModule } from "@/app/admin/guard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deals · Admin" };

type Props = { searchParams: Promise<{ q?: string; page?: string }> };

export default async function AdminDealsPage({ searchParams }: Props) {
  await requireAnyAdminModule(["collaborations", "contracts", "marketplace"]);
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = 25;
  const where = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { id: q },
          { parties: { some: { email: { contains: q, mode: "insensitive" as const } } } },
          { parties: { some: { name: { contains: q, mode: "insensitive" as const } } } },
        ],
      }
    : {};
  const [total, documents] = await prisma.$transaction([
    prisma.contractDocument.count({ where }),
    prisma.contractDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        parties: { select: { name: true, role: true, status: true } },
      },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-3xl font-bold text-indigo">Deals</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Each row is one agreement. Open it to see whether the parties agreed, who has signed, whether the provider
        confirmed the money, and which milestone or payout is next.
      </p>
      <form className="mt-4 flex flex-wrap gap-2" action="/admin/deals">
        <input
          name="q"
          defaultValue={q}
          placeholder="Title, party, or id"
          className="w-full max-w-md rounded-xl border border-border px-3 py-2 text-sm"
        />
        <button type="submit" className="btn-secondary !py-2 text-sm">
          Search
        </button>
      </form>
      <p className="mt-3 text-xs text-muted">
        {total} agreement{total === 1 ? "" : "s"} · page {page} of {pages}
      </p>
      <ul className="mt-4 space-y-3">
        {documents.map((document) => (
          <li key={document.id} className="rounded-2xl border border-[#E4EBFF] bg-white p-4">
            <Link href={`/admin/deals/${document.id}`} className="font-semibold text-violet hover:underline">
              {document.title}
            </Link>
            <p className="mt-1 text-xs text-muted">
              {document.status}
              {document.fundingId ? " · funding linked" : " · no funding yet"} ·{" "}
              {document.parties.map((party) => `${party.name} (${party.role}: ${party.status})`).join(" · ")}
            </p>
          </li>
        ))}
        {documents.length === 0 ? <li className="text-sm text-muted">No agreements match.</li> : null}
      </ul>
      <div className="mt-4 flex gap-3 text-sm">
        {page > 1 ? (
          <Link href={`/admin/deals?q=${encodeURIComponent(q)}&page=${page - 1}`} className="font-semibold text-violet">
            Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={`/admin/deals?q=${encodeURIComponent(q)}&page=${page + 1}`} className="font-semibold text-violet">
            Next
          </Link>
        ) : null}
      </div>
    </div>
  );
}
