import { redirect } from "next/navigation";
import {
  canAccessModule,
  getAdminSession,
  hasPermission,
  type AdminModule,
  type AdminPermission,
} from "@/lib/admin-auth";

const MODULE_PATH: Record<AdminModule, string> = {
  banners: "/admin/banners",
  cards: "/admin/cards",
  matching: "/admin/matching",
  intelligence: "/admin/intelligence",
  billing: "/admin/billing",
  plans: "/admin/plans",
  taxonomy: "/admin/taxonomy",
  payments: "/admin/payments",
  trust: "/admin/trust",
  agency: "/admin/agency",
  commerce: "/admin/fees",
  access: "/admin/access",
  accounts: "/admin/accounts",
  invitations: "/admin/invitations",
  collaborations: "/admin/collaborations",
  ai: "/admin/ai",
  gateways: "/admin/gateways",
  signing: "/admin/signing",
  social: "/admin/social",
  legal: "/admin/legal",
  shortlinks: "/admin/short-links",
  mail: "/admin/mail",
  jobs: "/admin/jobs",
};

/** Gate an admin page by module (any feature under that module). */
export async function requireAdminPage(module: AdminModule) {
  const session = await getAdminSession();
  const next = MODULE_PATH[module];
  if (!session) redirect(`/admin/login?next=${encodeURIComponent(next)}`);
  if (!canAccessModule(session, module)) redirect("/admin?error=forbidden");
  return session;
}

/** Gate a mutating server action by exact feature permission. */
export async function requireAdminAction(permission: AdminPermission) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!hasPermission(session, permission)) redirect("/admin?error=forbidden");
  return session;
}
