import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Marketplace ledger" };

/** The Phase 9 JSON escrow console is removed. Money lives on the marketplace ledger. */
export default function AdminPaymentsPage() {
  redirect("/admin/marketplace");
}
