import { Suspense } from "react";
import { canAccessModule, getAdminSession, type AdminModule } from "@/lib/admin-auth";
import { AdminShell, AdminSidebar, AdminTopBar, type AdminNavGroup } from "@/components/admin-shell";

type SideLink = {
  href: string;
  label: string;
  module?: AdminModule | "dashboard";
  anyModules?: AdminModule[];
  icon?: string;
};

type SideGroup = { name: string; links: SideLink[] };

const SIDE_GROUPS: SideGroup[] = [
  {
    name: "Main menu",
    links: [
      { href: "/admin", label: "Dashboard", module: "dashboard", icon: "home" },
      { href: "/admin/banners", label: "Banners", module: "banners", icon: "banners" },
      { href: "/admin/example-portraits", label: "Example portraits", module: "banners", icon: "cards" },
      { href: "/admin/value-prop", label: "Value proposition", module: "banners", icon: "value" },
      { href: "/admin/homepage", label: "Homepage", module: "banners", icon: "homepage" },
      {
        href: "/admin/collaboration-landing",
        label: "Collaboration landing",
        module: "banners",
        icon: "collab",
      },
      {
        href: "/admin/business-landing",
        label: "Business landing",
        module: "banners",
        icon: "business",
      },
      { href: "/admin/faq", label: "FAQ", module: "banners", icon: "faq" },
      { href: "/admin/stats", label: "Site stats", module: "banners", icon: "stats" },
      { href: "/admin/cards", label: "Influencer cards", module: "cards", icon: "cards" },
    ],
  },
  {
    name: "Members & access",
    links: [
      { href: "/admin/accounts", label: "Influencer accounts", module: "accounts", icon: "accounts" },
      {
        href: "/admin/business-accounts",
        label: "Business accounts",
        module: "accounts",
        icon: "bizAccounts",
      },
      { href: "/admin/accounts?tab=all", label: "All accounts", module: "accounts", icon: "agency" },
      { href: "/admin/admin-users", label: "Admin users", module: "access", icon: "accounts" },
      { href: "/admin/access", label: "Access levels", module: "access", icon: "access" },
      { href: "/admin/invitations", label: "Invitations", module: "invitations", icon: "invites" },
      { href: "/admin/agency", label: "Agency", module: "agency", icon: "agency" },
      { href: "/admin/guests", label: "Guest gates", module: "plans", icon: "guests" },
    ],
  },
  {
    name: "Plans & billing",
    links: [
      { href: "/admin/billing", label: "Billing", module: "billing", icon: "billing" },
      { href: "/admin/plans", label: "Plan entitlements", module: "plans", icon: "plans" },
    ],
  },
  {
    name: "Collaborations",
    links: [
      {
        href: "/admin/deals",
        label: "Deals",
        anyModules: ["collaborations", "contracts", "marketplace"],
        icon: "collab",
      },
      { href: "/admin/collaborations", label: "Collaborations", module: "collaborations", icon: "collab" },
      {
        href: "/admin/marketplace-listings",
        label: "Marketplace listings",
        module: "collaborations",
        icon: "default",
      },
      { href: "/admin/marketplace", label: "Marketplace ledger", module: "marketplace", icon: "billing" },
      { href: "/admin/matching", label: "Managed Matching", module: "matching", icon: "agency" },
      { href: "/admin/intelligence", label: "Intelligence", module: "intelligence", icon: "stats" },
      {
        href: "/admin/collaboration-ops",
        label: "Collaboration ops",
        module: "collab_finance",
        icon: "collab",
      },
      { href: "/admin/trust", label: "Trust & Disputes", module: "trust", icon: "access" },
    ],
  },
  {
    name: "Payments & finance",
    links: [
      {
        href: "/admin/payment-settings",
        label: "Payment settings",
        anyModules: ["gateways", "collab_finance", "marketplace"],
        icon: "billing",
      },
      { href: "/admin/gateways", label: "Payment gateways", module: "gateways", icon: "billing" },
      { href: "/admin/search", label: "Meilisearch", module: "gateways", icon: "stats" },
      { href: "/admin/fees", label: "Collaboration fees", module: "commerce", icon: "billing" },
      { href: "/admin/corridors", label: "Corridors", module: "collab_finance", icon: "business" },
      { href: "/admin/kyc", label: "KYC", module: "collab_finance", icon: "cards" },
    ],
  },
  {
    name: "Integrations & ops",
    links: [
      { href: "/admin/ai", label: "AI pipelines", module: "ai", icon: "value" },
      { href: "/admin/signing", label: "Document signing", module: "signing", icon: "faq" },
      { href: "/admin/contracts", label: "Contracts", module: "contracts", icon: "faq" },
      { href: "/admin/social", label: "Social networks", module: "social", icon: "agency" },
      { href: "/admin/legal", label: "Legal documents", module: "legal", icon: "faq" },
      { href: "/admin/short-links", label: "Short links", module: "shortlinks", icon: "homepage" },
      { href: "/admin/referrals", label: "Referrals", module: "shortlinks", icon: "invites" },
      { href: "/admin/mail", label: "Email", module: "mail", icon: "invites" },
      { href: "/admin/jobs", label: "Jobs", module: "jobs", icon: "stats" },
      { href: "/admin/taxonomy", label: "Taxonomy", module: "taxonomy", icon: "cards" },
    ],
  },
];

/** Signed-in admin chrome with design top bar + left sidebar (login stays clean). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  if (!session) {
    return <div>{children}</div>;
  }

  const groups: AdminNavGroup[] = SIDE_GROUPS.map((group) => ({
    name: group.name,
    links: group.links
      .filter((l) =>
        l.anyModules
          ? l.anyModules.some((module) => canAccessModule(session, module))
          : l.module === "dashboard"
            ? true
            : canAccessModule(session, l.module as AdminModule),
      )
      .map((l) => ({ href: l.href, label: l.label, icon: l.icon })),
  })).filter((group) => group.links.length > 0);

  return (
    <AdminShell
      topBar={
        <AdminTopBar name={session.name} email={session.email} roleName={session.roleName} />
      }
      sidebar={
        <Suspense fallback={<div className="w-[240px] shrink-0 border-r border-[#E4EBFF] bg-white" />}>
          <AdminSidebar groups={groups} roleName={session.roleName} />
        </Suspense>
      }
    >
      {children}
    </AdminShell>
  );
}
