import Link from "next/link";
import {
  actionAdminDestination,
  actionMakePrimaryDomain,
  actionOpenAbuse,
  actionReleaseSlug,
  actionReserveSlug,
  actionSaveShortDomain,
  actionSaveShortSettings,
  actionSetLinkStatus,
} from "@/app/admin/short-links/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { hasPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { ensureShortLinkDefaults, getShortLinkSettings } from "@/lib/short-link";
import { shortLinkHosts } from "@/lib/short-link-hosts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Short links · Admin" };

const inputClass = "mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal";

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminShortLinksPage({ searchParams }: Props) {
  const session = await requireAdminPage("shortlinks");
  const canEdit = hasPermission(session, "shortlinks.edit");
  const params = await searchParams;
  let domains: Awaited<ReturnType<typeof prisma.shortLinkDomain.findMany>> = [];
  let reserved: Awaited<ReturnType<typeof prisma.reservedSlug.findMany>> = [];
  let links: Awaited<
    ReturnType<
      typeof prisma.shortLink.findMany<{
        include: { creator: true; qrIdentities: { where: { status: "active" }; take: 1 } };
      }>
    >
  > = [];
  let events: Awaited<ReturnType<typeof prisma.shortLinkEvent.findMany>> = [];
  let cases: Awaited<ReturnType<typeof prisma.shortLinkAbuseCase.findMany>> = [];
  let settings: Awaited<ReturnType<typeof getShortLinkSettings>> | null = null;
  let dbError = false;
  try {
    await ensureShortLinkDefaults();
    [domains, reserved, events, cases, settings] = await Promise.all([
      prisma.shortLinkDomain.findMany({ orderBy: { hostname: "asc" } }),
      prisma.reservedSlug.findMany({ orderBy: { slug: "asc" } }),
      prisma.shortLinkEvent.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
      prisma.shortLinkAbuseCase.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
      getShortLinkSettings(),
    ]);
    links = await prisma.shortLink.findMany({
      include: { creator: true, qrIdentities: { where: { status: "active" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
      take: 40,
    });
  } catch (error) {
    console.error("admin short links", error);
    dbError = true;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
        ← Admin
      </Link>
      <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Short links</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        inflr.me is redirect infrastructure. Creator profiles stay on the canonical Influrios origin. QR codes encode
        an opaque /q token on the primary short domain, so a slug change does not require a reprint. Sign in again if
        this page was forbidden after the permission was added.
      </p>
      <p className="mt-2 text-xs text-muted">
        Hosts recognized at the edge: {shortLinkHosts().join(", ")}. Add any extra hostname to SHORT_LINK_HOSTS as well
        as the domain list below.
      </p>
      {params.saved ? <p className="mt-4 text-sm font-semibold text-emerald-700">Saved.</p> : null}
      {params.error ? <p className="mt-4 text-sm text-amber-800">{params.error}</p> : null}
      {dbError ? <p className="mt-4 text-sm text-amber-800">Short links are unavailable.</p> : null}

      <section className="card-surface mt-6 p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Domains</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {domains.map((domain) => (
            <li key={domain.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {domain.hostname} · {domain.label} · {domain.active ? "active" : "off"}
                {domain.isPrimary ? " · primary" : ""}
                {domain.fallback ? " · fallback" : ""}
              </span>
              {canEdit && !domain.isPrimary ? (
                <form action={actionMakePrimaryDomain}>
                  <input type="hidden" name="id" value={domain.id} />
                  <button type="submit" className="btn-secondary !py-1 text-xs">
                    Make primary
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {canEdit ? (
          <form action={actionSaveShortDomain} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="text-sm font-semibold text-indigo">
              Hostname
              <input name="hostname" placeholder="links.example.com" className={inputClass} />
            </label>
            <label className="text-sm font-semibold text-indigo">
              Label
              <input name="label" className={inputClass} />
            </label>
            <button type="submit" className="btn-primary !py-2 text-sm">
              Add domain
            </button>
          </form>
        ) : null}
      </section>

      {settings && canEdit ? (
        <form action={actionSaveShortSettings} className="card-surface mt-4 space-y-3 p-5">
          <h2 className="font-display text-lg font-bold text-indigo">Canonical origin and allow list</h2>
          <label className="block text-sm font-semibold text-indigo">
            Canonical origin
            <input name="canonicalOrigin" defaultValue={settings.canonicalOrigin} className={inputClass} />
          </label>
          <label className="block text-sm font-semibold text-indigo">
            Allowed https hosts
            <textarea name="allowedHosts" defaultValue={settings.allowedHosts} rows={3} className={inputClass} />
          </label>
          <button type="submit" className="btn-primary !py-2 text-sm">
            Save redirect rules
          </button>
        </form>
      ) : null}

      <section className="card-surface mt-4 p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Reserved names</h2>
        <ul className="mt-3 flex flex-wrap gap-2 text-xs">
          {reserved.map((row) => (
            <li key={row.slug} className="rounded-full bg-lavender px-2 py-1 text-indigo">
              {row.slug}
              {canEdit ? (
                <form action={actionReleaseSlug} className="inline">
                  <input type="hidden" name="slug" value={row.slug} />
                  <button type="submit" className="ml-1 font-semibold text-violet">
                    release
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {canEdit ? (
          <form action={actionReserveSlug} className="mt-4 flex flex-wrap gap-2">
            <input name="slug" placeholder="slug" className="rounded-xl border border-border px-3 py-2 text-sm" />
            <input name="reason" placeholder="reason" className="rounded-xl border border-border px-3 py-2 text-sm" />
            <button type="submit" className="btn-secondary text-sm">
              Reserve
            </button>
          </form>
        ) : null}
      </section>

      <section className="card-surface mt-4 p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Links</h2>
        <ul className="mt-3 space-y-3 text-sm">
          {links.map((link) => (
            <li key={link.id} className="rounded-xl border border-border p-3">
              <p className="font-semibold text-indigo">
                /{link.slug} · {link.status} · {link.dynamic ? "dynamic" : "standard"}
              </p>
              <p className="text-xs text-muted">
                {link.creator?.displayName ?? "unassigned"} · {link.destination}
                {link.qrIdentities[0] ? ` · QR ${link.qrIdentities[0].token}` : ""}
              </p>
              {canEdit ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <form action={actionSetLinkStatus}>
                    <input type="hidden" name="id" value={link.id} />
                    <input type="hidden" name="status" value={link.status === "active" ? "suspended" : "active"} />
                    <button type="submit" className="btn-secondary !py-1 text-xs">
                      {link.status === "active" ? "Suspend" : "Restore"}
                    </button>
                  </form>
                  {link.dynamic ? (
                    <form action={actionAdminDestination} className="flex gap-2">
                      <input type="hidden" name="id" value={link.id} />
                      <input name="destination" placeholder="/c/slug or https://influrios.com/..." className="rounded-lg border border-border px-2 py-1 text-xs" />
                      <button type="submit" className="btn-secondary !py-1 text-xs">
                        Update destination
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
          {!links.length ? <li className="text-muted">No short links yet. Plus and Pro cards receive one on first use.</li> : null}
        </ul>
      </section>

      <section className="card-surface mt-4 p-5">
        <h2 className="font-display text-lg font-bold text-indigo">Recent events</h2>
        <ul className="mt-3 space-y-1 text-xs text-muted">
          {events.map((event) => (
            <li key={event.id}>
              {event.createdAt.toISOString()} · {event.eventType}
            </li>
          ))}
        </ul>
        {canEdit ? (
          <form action={actionOpenAbuse} className="mt-4 flex flex-wrap gap-2">
            <input name="slug" placeholder="slug" className="rounded-xl border border-border px-3 py-2 text-sm" />
            <input name="note" placeholder="abuse note" className="min-w-48 flex-1 rounded-xl border border-border px-3 py-2 text-sm" />
            <button type="submit" className="btn-secondary text-sm">
              Open case
            </button>
          </form>
        ) : null}
        <ul className="mt-3 space-y-1 text-xs text-muted">
          {cases.map((item) => (
            <li key={item.id}>
              {item.status} · {item.slug || "no slug"} · {item.note}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
