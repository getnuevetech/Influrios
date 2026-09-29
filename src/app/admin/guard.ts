import { redirect } from "next/navigation";
import {
  getAdminSession,
  type AdminPermission,
} from "@/lib/admin-auth";

const PERM_PATH: Record<AdminPermission, string> = {
  banners: "/admin/banners",
  cards: "/admin/cards",
  matching: "/admin/matching",
  intelligence: "/admin/intelligence",
  billing: "/admin/billing",
  access: "/admin/access",
};

/** Gate an admin page by permission. Call at top of each console page. */
export async function requireAdminPage(permission: AdminPermission) {
  const session = await getAdminSession();
  const next = PERM_PATH[permission];
  if (!session) redirect(`/admin/login?next=${encodeURIComponent(next)}`);
  if (!session.permissions.includes(permission)) redirect("/admin?error=forbidden");
  return session;
}
