import { NextResponse } from "next/server";
import { requireAdminPage } from "@/app/admin/guard";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function cell(value: string | null | undefined) {
  const text = value ?? "";
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export async function GET() {
  await requireAdminPage("legal");
  const rows = await prisma.legalAcceptance.findMany({
    orderBy: { acceptedAt: "asc" },
    take: 5000,
  });
  const header = [
    "accepted_at",
    "user_id",
    "subject_key",
    "document_key",
    "document_version",
    "document_hash",
    "acceptance_type",
    "acceptance_context",
    "user_role",
    "country",
    "ip",
  ];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.acceptedAt.toISOString(),
        row.userId,
        row.subjectKey,
        row.documentKey,
        row.documentVersion,
        row.documentHash,
        row.acceptanceType,
        row.acceptanceContext,
        row.userRole,
        row.country,
        row.ip,
      ]
        .map((value) => cell(value))
        .join(","),
    ),
  ];
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=influrios-legal-acceptances.csv",
    },
  });
}
