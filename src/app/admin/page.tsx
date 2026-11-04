import { redirect } from "next/navigation";
import { AdminPlatformOverview } from "@/components/admin-dashboard-ui";
import { getAdminSession } from "@/lib/admin-auth";
import { loadAdminDashboard } from "@/lib/admin-dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Platform Overview · Admin" };

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const params = await searchParams;
  const data = await loadAdminDashboard({
    name: session.name,
    email: session.email,
    roleName: session.roleName,
  });

  return (
    <AdminPlatformOverview data={data} forbidden={params.error === "forbidden"} />
  );
}
