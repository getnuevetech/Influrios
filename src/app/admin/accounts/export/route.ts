import { NextResponse } from "next/server";
import { requireAdminPage } from "@/app/admin/guard";
import { loadAccountTable, type AccountsTab } from "@/lib/admin-accounts";

export const dynamic = "force-dynamic";

function cell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function parseTab(raw: string | null): AccountsTab {
  if (raw === "business" || raw === "all" || raw === "influencer") return raw;
  return "influencer";
}

export async function GET(request: Request) {
  await requireAdminPage("accounts");
  const url = new URL(request.url);
  const tab = parseTab(url.searchParams.get("tab"));
  const q = url.searchParams.get("q") || undefined;
  const email = url.searchParams.get("email") || undefined;
  const phone = url.searchParams.get("phone") || undefined;
  const handle = url.searchParams.get("handle") || undefined;
  const status = (url.searchParams.get("status") as "active" | "suspended" | "all") || "all";
  const plan = url.searchParams.get("plan") || undefined;
  const kyc =
    (url.searchParams.get("kyc") as "verified" | "pending" | "unverified" | "rejected" | "all") ||
    "all";

  const { rows } = await loadAccountTable({
    tab,
    q,
    email,
    phone,
    handle,
    status,
    plan,
    kyc,
    page: 1,
    pageSize: 500,
  });

  const header = [
    "id",
    "email",
    "phone",
    "preferred_channel",
    "name",
    "handle",
    "business_name",
    "business_contact_name",
    "business_contact_email",
    "business_contact_phone",
    "role",
    "plan",
    "kyc",
    "status",
    "joined",
    "location",
    "followers",
    "collaborations",
    "earnings_ytd_cents",
  ];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.id,
        row.email,
        row.phone,
        row.preferredCommChannel,
        row.displayName,
        row.handle,
        row.businessName,
        row.contactName,
        row.contactEmail,
        row.contactPhone,
        row.role,
        row.planTier,
        row.identityVerified,
        row.suspendedAt ? "restricted" : "active",
        row.createdAt.slice(0, 10),
        row.locationLabel,
        row.followers,
        row.collaborations,
        row.earningsYtdCents,
      ]
        .map(cell)
        .join(","),
    ),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=influrios-accounts-${tab}.csv`,
    },
  });
}
