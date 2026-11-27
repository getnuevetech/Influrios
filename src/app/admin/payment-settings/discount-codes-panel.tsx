import { Country } from "country-state-city";
import { DiscountCodesClient } from "@/app/admin/payment-settings/discount-codes-client";
import { getAdminSession, hasPermission } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { SERVICE_LEVEL_LABELS, SERVICE_LEVELS } from "@/lib/collaboration-fees";
import { listDiscountAudits, listDiscountOffers } from "@/lib/discount-store";

export async function DiscountCodesPanel() {
  const session = await getAdminSession();
  const canIssue = Boolean(session && hasPermission(session, "discounts.manage"));
  const canViewRedemptions = Boolean(session && (hasPermission(session, "discounts.view") || hasPermission(session, "discounts.manage")));
  const listed = await listDiscountOffers();
  const plans = await prisma.entitlementPlan.findMany({
    where: { active: true },
    select: { code: true, name: true, amountCents: true },
    orderBy: { sortOrder: "asc" },
  }).catch(() => []);
  const audits: Record<string, { id: string; actorId: string; action: string; createdAt: string }[]> = {};
  if (canViewRedemptions) {
    await Promise.all(listed.offers.map(async (offer) => {
      const rows = await listDiscountAudits(offer.id);
      audits[offer.id] = rows.map((row) => ({
        id: row.id,
        actorId: row.actorId,
        action: row.action,
        createdAt: row.createdAt.toISOString(),
      }));
    }));
  }
  const countries = Country.getAllCountries().map((country) => ({ code: country.isoCode, name: country.name }));
  return (
    <DiscountCodesClient
      offers={listed.offers}
      plans={plans}
      countries={countries}
      canIssue={canIssue}
      canViewRedemptions={canViewRedemptions}
      audits={audits}
      databaseError={listed.ok ? "" : listed.error}
      serviceLevels={SERVICE_LEVELS.map((level) => ({ id: level, label: SERVICE_LEVEL_LABELS[level] }))}
    />
  );
}
