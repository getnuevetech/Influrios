import { loadAirwallexConfig } from "@/lib/providers/airwallex-config";
import { createAirwallexFunding, loginAirwallex } from "@/lib/providers/airwallex";
import { createFlutterwaveCharge } from "@/lib/providers/flutterwave";
import { createMpesaCharge } from "@/lib/providers/mpesa";
import { prisma } from "@/lib/db";
import { decryptSecret } from "@/lib/provider-secrets";

export type CollectionProvider = "flutterwave" | "mpesa" | "airwallex";

export function collectionProviderCode(code: string | null | undefined): CollectionProvider | null {
  const value = (code ?? "").trim().toLowerCase();
  if (value === "flutterwave" || value === "mpesa" || value === "airwallex") return value;
  return null;
}

async function paymentGateway(code: CollectionProvider) {
  const row = await prisma.integrationProvider.findUnique({
    where: { kind_code: { kind: "payment", code } },
  });
  if (!row?.enabled || !row.secretCipher) return null;
  const secret = decryptSecret(row.secretCipher);
  if (!secret) return null;
  return { secret, baseUrl: row.baseUrl ?? "", publicKey: row.publicKey ?? "" };
}

/** Opens a provider charge from the credentials saved on the payment gateway. Does not mark the funding paid. */
export async function openFundingCollection(input: {
  providerCode: string;
  fundingId: string;
  amountCents: number;
  currency: string;
  email: string;
  phone?: string;
  milestones: { id: string; amountCents: number }[];
  origin: string;
}): Promise<{ ok: true; reference: string; url?: string } | { ok: false; error: string }> {
  const provider = collectionProviderCode(input.providerCode);
  if (!provider) {
    return { ok: false, error: "Assign Flutterwave, M-Pesa, or Airwallex to this country before opening checkout." };
  }
  const redirectUrl = `${input.origin}/payments?returned=1&funding=${encodeURIComponent(input.fundingId)}`;
  const callbackUrl = `${input.origin}/api/marketplace/webhook`;
  if (provider === "flutterwave") {
    const gateway = await paymentGateway("flutterwave");
    if (!gateway) return { ok: false, error: "Save and enable the Flutterwave secret in admin. Nothing was charged." };
    if (!input.email.trim()) return { ok: false, error: "A payer email is required. Nothing was charged." };
    const opened = await createFlutterwaveCharge({
      secret: gateway.secret,
      baseUrl: gateway.baseUrl || undefined,
      txRef: input.fundingId,
      amountCents: input.amountCents,
      currency: input.currency,
      email: input.email.trim(),
      redirectUrl,
    });
    if (!opened.ok) return opened;
    return { ok: true, reference: opened.chargeId, url: opened.link };
  }
  if (provider === "mpesa") {
    const gateway = await paymentGateway("mpesa");
    if (!gateway) return { ok: false, error: "Save and enable the M-Pesa access token in admin. Nothing was charged." };
    if (!gateway.publicKey.trim()) return { ok: false, error: "Save the M-Pesa business short code in admin. Nothing was charged." };
    if (!input.phone?.trim()) return { ok: false, error: "An M-Pesa phone number is required. Nothing was charged." };
    const opened = await createMpesaCharge({
      secret: gateway.secret,
      baseUrl: gateway.baseUrl || undefined,
      shortCode: gateway.publicKey.trim(),
      txRef: input.fundingId,
      amountCents: input.amountCents,
      phone: input.phone.trim(),
      callbackUrl,
    });
    if (!opened.ok) return opened;
    return { ok: true, reference: opened.checkoutRequestId };
  }
  const settings = await loadAirwallexConfig();
  if (!settings) return { ok: false, error: "Save and enable the Airwallex client id, API key, and base URL in admin. Nothing was charged." };
  if (!settings.holdingAccountId || !settings.operationsAccountId) {
    return { ok: false, error: "Save the Airwallex holding account id and operations account id in admin. Nothing was charged." };
  }
  if (input.milestones.length < 1) return { ok: false, error: "This funding has no milestones. Nothing was charged." };
  const login = await loginAirwallex({ baseUrl: settings.baseUrl, clientId: settings.clientId, apiKey: settings.apiKey });
  if (!login.ok) return login;
  const opened = await createAirwallexFunding({
    baseUrl: settings.baseUrl,
    token: login.token,
    request: {
      fundingId: input.fundingId,
      amountCents: input.amountCents,
      currency: input.currency,
      holdingAccountId: settings.holdingAccountId,
      splits: input.milestones.map((milestone) => ({
        milestoneId: milestone.id,
        amountCents: milestone.amountCents,
        connectedAccountId: settings.operationsAccountId,
      })),
    },
  });
  if (!opened.ok) return opened;
  return { ok: true, reference: opened.paymentId, url: opened.url };
}
