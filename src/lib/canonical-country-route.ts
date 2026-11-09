import { updateCorridor } from "@/lib/collab-control-plane";
import { prisma } from "@/lib/db";
import { ensureMarketplaceProviderForCode } from "@/lib/marketplace-ledger";
import { storedCurrencyCode } from "@/lib/money";
import { setCountryGateway } from "@/lib/providers";

export const ROUTE_FIELDS_MESSAGE =
  "Currency, precision, collection, holding, and the payout gateway are edited on Payment settings.";

/** Write the country route once so the corridor, jurisdiction, and gateway cannot disagree. */
export async function saveCanonicalCountryRoute(input: {
  countryCode: string;
  actor: string;
  currency: string;
  minorDigits: number;
  collectionProviderCode: string;
  holdingProviderCode: string;
  payoutGatewayCode: string;
}) {
  const countryCode = input.countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error("Use a two-letter country code.");
  const currency = storedCurrencyCode(input.currency);
  if (!currency) throw new Error("Choose a currency.");
  if (!Number.isInteger(input.minorDigits) || input.minorDigits < 0 || input.minorDigits > 4) {
    throw new Error("Minor digits must be from 0 to 4.");
  }
  const corridor = await prisma.countryActivationCorridor.findUnique({ where: { countryCode } });
  if (!corridor) throw new Error("Add this country on Corridors before saving its route.");
  const jurisdiction = await prisma.collaborationJurisdiction.findUnique({ where: { code: countryCode } });
  if (!jurisdiction) throw new Error("Add this jurisdiction on Marketplace settings before saving its route.");
  const holding = input.holdingProviderCode.trim().toLowerCase();
  if (!holding) throw new Error("Choose a holding provider.");
  const assigned = await ensureMarketplaceProviderForCode({ code: holding });
  if (!assigned) throw new Error("Choose a holding provider.");
  const payout = await prisma.integrationProvider.findFirst({
    where: { code: input.payoutGatewayCode.trim().toLowerCase(), kind: "payment" },
  });
  if (!payout) throw new Error("Choose a payout gateway.");
  const methods = Array.isArray(corridor.payoutMethodsJson) ? (corridor.payoutMethodsJson as string[]) : [];
  const before = {
    currency: corridor.currency,
    collectionProviderCode: corridor.collectionProviderCode,
    jurisdictionCurrency: jurisdiction.currency,
    minorDigits: jurisdiction.minorDigits,
    holdingProviderCode: jurisdiction.providerCode,
  };
  await updateCorridor({
    countryCode,
    actor: input.actor,
    currency,
    collectionProviderCode: input.collectionProviderCode.trim() || null,
    holdingEnabled: corridor.holdingEnabled,
    fxEnabled: corridor.fxEnabled,
    kycModel: corridor.kycModel,
    notes: corridor.notes,
    payoutMethods: methods,
  });
  await prisma.collaborationJurisdiction.update({
    where: { code: countryCode },
    data: { currency, minorDigits: input.minorDigits, providerCode: holding },
  });
  await setCountryGateway(countryCode, payout.id);
  await prisma.auditLog.create({
    data: {
      actor: input.actor.slice(0, 120),
      action: "payment_route.save",
      objectType: "CountryRoute",
      objectId: countryCode,
      before,
      after: {
        currency,
        minorDigits: input.minorDigits,
        collectionProviderCode: input.collectionProviderCode.trim() || null,
        holdingProviderCode: holding,
        payoutGatewayCode: payout.code,
      },
    },
  });
  return { countryCode };
}
