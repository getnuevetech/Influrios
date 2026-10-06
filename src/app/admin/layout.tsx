import Link from "next/link";
import { actionAdminLogout } from "@/app/admin/actions-auth";
import { canAccessModule, getAdminSession, type AdminModule } from "@/lib/admin-auth";
import {
  isLegacyDemoPaymentsAdminHref,
  legacyDemoPaymentsEnabled,
} from "@/lib/legacy-demo-payments";

type SideLink = { href: string; label: string; module?: AdminModule | "dashboard" };

type SideGroup = { name: string; links: SideLink[] };

const SIDE_GROUPS: SideGroup[] = [
  {
    name: "Main menu",
    links: [
      { href: "/admin", label: "Dashboard", module: "dashboard" },
      { href: "/admin/banners", label: "Banners", module: "banners" },
      { href: "/admin/value-prop", label: "Value proposition", module: "banners" },
      { href: "/admin/homepage", label: "Homepage", module: "banners" },
      { href: "/admin/stats", label: "Site stats", module: "banners" },
      { href: "/admin/cards", label: "Influencer cards", module: "cards" },
    ],
  },
  {
    name: "Members & access",
    links: [
      { href: "/admin/accounts", label: "Member accounts", module: "accounts" },
      { href: "/admin/invitations", label: "Invitations", module: "invitations" },
      { href: "/admin/access", label: "Access levels", module: "access" },
      { href: "/admin/agency", label: "Agency", module: "agency" },
      { href: "/admin/guests", label: "Guest gates", module: "plans" },
    ],
  },
  {
    name: "Plans & billing",
    links: [
      { href: "/admin/billing", label: "Billing", module: "billing" },
      { href: "/admin/plans", label: "Plan entitlements", module: "plans" },
    ],
  },
  {
    name: "Collaborations",
    links: [
      { href: "/admin/collaborations", label: "Collaborations", module: "collaborations" },
      { href: "/admin/marketplace-listings", label: "Marketplace listings", module: "collaborations" },
      { href: "/admin/marketplace", label: "Marketplace ledger", module: "marketplace" },
      { href: "/admin/matching", label: "Managed Matching", module: "matching" },
      { href: "/admin/intelligence", label: "Intelligence", module: "intelligence" },
      { href: "/admin/collaboration-ops", label: "Collaboration ops", module: "collab_finance" },
      { href: "/admin/trust", label: "Trust & Disputes", module: "trust" },
    ],
  },
  {
    name: "Payments & finance",
    links: [
      { href: "/admin/gateways", label: "Payment gateways", module: "gateways" },
      { href: "/admin/payments", label: "Protected Payments", module: "payments" },
      { href: "/admin/fees", label: "Collaboration fees", module: "commerce" },
      { href: "/admin/corridors", label: "Corridors", module: "collab_finance" },
    ],
  },
  {
    name: "Integrations & ops",
    links: [
      { href: "/admin/ai", label: "AI pipelines", module: "ai" },
      { href: "/admin/signing", label: "Document signing", module: "signing" },
      { href: "/admin/social", label: "Social networks", module: "social" },
      { href: "/admin/legal", label: "Legal documents", module: "legal" },
      { href: "/admin/short-links", label: "Short links", module: "shortlinks" },
      { href: "/admin/mail", label: "Email", module: "mail" },
      { href: "/admin/jobs", label: "Jobs", module: "jobs" },
      { href: "/admin/taxonomy", label: "Taxonomy", module: "taxonomy" },
    ],
  },
];

/** Signed-in admin chrome with left sidebar (login page stays clean when no session). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  const legacyDemoOn = session ? await legacyDemoPaymentsEnabled() : false;

  if (!session) {
    return <div>{children}</div>;
  }

  const groups = SIDE_GROUPS.map((group) => ({
    ...group,
    links: group.links.filter((l) => {
      if (!legacyDemoOn && isLegacyDemoPaymentsAdminHref(l.href)) return false;
      return l.module === "dashboard" ? true : canAccessModule(session, l.module as AdminModule);
    }),
  })).filter((group) => group.links.length > 0);

  return (
    <div className="min-h-screen bg-[#F5F8FF]">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 flex h-screen w-[240px] shrink-0 flex-col border-r border-[#E4EBFF] bg-white">
          <div className="border-b border-[#E4EBFF] px-4 py-4">
            <Link href="/admin" className="font-display text-[15px] font-bold text-indigo">
              Influrios Admin
            </Link>
            <p className="mt-1 truncate text-[11px] text-muted">
              {session.name} · {session.roleName}
            </p>
          </div>
          <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
            {groups.map((group) => (
              <div key={group.name}>
                <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                  {group.name}
                </p>
                <div className="space-y-0.5">
                  {group.links.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="block rounded-lg px-3 py-2 text-[13px] font-semibold text-indigo/80 hover:bg-[#EEF2FF] hover:text-violet"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="space-y-2 border-t border-[#E4EBFF] px-3 py-3">
            <Link href="/" className="block text-[12px] font-semibold text-violet hover:underline">
              ← View site
            </Link>
            <form action={actionAdminLogout}>
              <button
                type="submit"
                className="w-full rounded-lg border border-[#E4EBFF] bg-white px-3 py-2 text-left text-[12px] font-semibold text-muted hover:text-indigo"
              >
                Sign out
              </button>
            </form>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="border-b border-[#E4EBFF] bg-white/90 px-4 py-2.5 sm:px-6">
            <p className="text-[12px] text-muted">
              Admin portal · <span className="font-semibold text-indigo">{session.email}</span>
            </p>
          </div>
          <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
