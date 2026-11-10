import { openAirwallexFundingCollection } from "@/lib/providers/airwallex-runtime";
import { createFlutterwaveCharge } from "@/lib/providers/flutterwave";
import { createMpesaCharge } from "@/lib/providers/mpesa";
import { prisma } from "@/lib/db";
import { readSignedDealMoney } from "@/lib/payment-engine";
import { claimProviderCommand, collectionInstructionAmount, recordProviderCommandResult } from "@/lib/provider-outbox";
import { decryptSecret } from "@/lib/provider-secrets";

export type CollectionProvider = "flutterwave" | "mpesa" | "airwallex";

export function collectionProviderCode(code: string | null | undefined): CollectionProvider | null {
  const value = (code ?? "").trim().toLowerCase();
  if (value === "flutterwave" || value === "mpesa" || value === "airwallex") return value;
  return null;
}

/** Checkout fields follow the collection route saved on the prefund. */
export function collectionCheckoutFields(providerCode: string | null | undefined): {
  email: boolean;
  phone: boolean;
  canOpen: boolean;
  note: string;
} {
  const provider = (providerCode ?? "").trim().toLowerCase();
  if (provider === "flutterwave") {
    return {
      email: true,
      phone: false,
      canOpen: true,
      note: "Flutterwave collects this prefund. A payer email is required. Nothing is marked paid until the webhook.",
    };
  }
  if (provider === "mpesa") {
    return {
      email: false,
      phone: true,
      canOpen: true,
      note: "M-Pesa collects this prefund. A phone number and the saved short code are required. Nothing is marked paid until the webhook.",
    };
  }
  if (provider === "airwallex") {
    return {
      email: false,
      phone: false,
      canOpen: true,
      note: "Airwallex collects this prefund from the holding and operations accounts saved on the route. Nothing is marked paid until the webhook.",
    };
  }
  if (provider === "stripe") {
    return { email: false, phone: false, canOpen: false, note: "" };
  }
  return {
    email: false,
    phone: false,
    canOpen: false,
    note: "This prefund has no collection provider that can open checkout. Nothing was charged.",
  };
}

/** True when the corridor collection route onboards influencers via a connected-account provider. */
export function isConnectedAccountCollectionProvider(code: string | null | undefined): boolean {
  return collectionProviderCode(code) === "airwallex";
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

function agreementVersionFromPlan(plan: unknown) {
  if (!plan || typeof plan !== "object" || !("signedQuote" in plan)) return 1;
  const version = Number((plan as { signedQuote?: { agreementVersion?: number } }).signedQuote?.agreementVersion ?? 1);
  return Number.isInteger(version) && version > 0 ? version : 1;
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
    const route = (input.providerCode ?? "").trim() || "none";
    return {
      ok: false,
      error:
        route.toLowerCase() === "stripe"
          ? "Stripe is the collection route. Checkout does not open a Flutterwave or M-Pesa charge. Nothing was charged."
          : "This collection route cannot open checkout. Nothing was charged.",
    };
  }
  const funding = await prisma.collaborationFunding.findUnique({
    where: { id: input.fundingId.trim() },
    select: { id: true, grossCents: true, currency: true, feeSnapshotJson: true, providerPaymentId: true, status: true },
  });
  if (!funding || funding.status !== "awaiting_provider") {
    return { ok: false, error: "This funding is not waiting for a provider. Nothing was charged." };
  }
  if (funding.providerPaymentId) {
    return { ok: true, reference: funding.providerPaymentId };
  }
  const plan = (funding.feeSnapshotJson as { financialPlan?: unknown } | null)?.financialPlan;
  const signed = readSignedDealMoney(plan);
  const planned = collectionInstructionAmount({
    fundingGrossCents: funding.grossCents,
    signedBusinessPaysCents: signed?.businessPaysCents ?? null,
  });
  if (!planned.ok) return planned;
  if (input.amountCents !== planned.amountCents || input.currency.trim().toUpperCase() !== funding.currency.trim().toUpperCase()) {
    return { ok: false, error: "The collection instruction does not match the stored funding. Nothing was charged." };
  }
  const redirectUrl = `${input.origin}/payments?returned=1&funding=${encodeURIComponent(funding.id)}`;
  const callbackUrl = `${input.origin}/api/marketplace/webhook`;
  const gateway = provider === "airwallex" ? null : await paymentGateway(provider);
  if (provider === "flutterwave") {
    if (!input.email.trim()) return { ok: false, error: "A payer email is required. Nothing was charged." };
    if (!gateway) return { ok: false, error: "Save and enable the Flutterwave secret in admin. Nothing was charged." };
  }
  if (provider === "mpesa") {
    if (!input.phone?.trim()) return { ok: false, error: "An M-Pesa phone number is required. Nothing was charged." };
    if (!gateway) return { ok: false, error: "Save and enable the M-Pesa access token in admin. Nothing was charged." };
    if (!gateway.publicKey.trim()) {
      return { ok: false, error: "Save the M-Pesa business short code in admin. Nothing was charged." };
    }
  }
  const claim = await claimProviderCommand({
    agreementVersion: agreementVersionFromPlan(plan),
    fundingId: funding.id,
    operation: "collection",
    amountCents: planned.amountCents,
    currency: funding.currency,
  });
  if (!claim.dispatch) {
    if (claim.providerRef) return { ok: true, reference: claim.providerRef };
    return { ok: false, error: `${claim.reason} Nothing was charged.` };
  }
  try {
    if (provider === "flutterwave" && gateway) {
      const opened = await createFlutterwaveCharge({
        secret: gateway.secret,
        baseUrl: gateway.baseUrl || undefined,
        txRef: funding.id,
        amountCents: planned.amountCents,
        currency: funding.currency,
        email: input.email.trim(),
        redirectUrl,
      });
      if (!opened.ok) {
        await recordProviderCommandResult({ commandId: claim.commandId, ok: false });
        return opened;
      }
      await recordProviderCommandResult({ commandId: claim.commandId, ok: true, providerRef: opened.chargeId });
      return { ok: true, reference: opened.chargeId, url: opened.link };
    }
    if (provider === "mpesa" && gateway) {
      const opened = await createMpesaCharge({
        secret: gateway.secret,
        baseUrl: gateway.baseUrl || undefined,
        shortCode: gateway.publicKey.trim(),
        txRef: funding.id,
        amountCents: planned.amountCents,
        phone: input.phone!.trim(),
        callbackUrl,
      });
      if (!opened.ok) {
        await recordProviderCommandResult({ commandId: claim.commandId, ok: false });
        return opened;
      }
      await recordProviderCommandResult({
        commandId: claim.commandId,
        ok: true,
        providerRef: opened.checkoutRequestId,
      });
      return { ok: true, reference: opened.checkoutRequestId };
    }
    if (provider !== "airwallex") {
      await recordProviderCommandResult({ commandId: claim.commandId, ok: false });
      return { ok: false, error: "The collection provider is not ready. Nothing was charged." };
    }
    const opened = await openAirwallexFundingCollection({ fundingId: funding.id });
    if (!opened.ok) {
      await recordProviderCommandResult({ commandId: claim.commandId, ok: false });
      return opened;
    }
    await recordProviderCommandResult({ commandId: claim.commandId, ok: true, providerRef: opened.reference });
    return opened;
  } catch (error) {
    await recordProviderCommandResult({ commandId: claim.commandId, ok: false });
    const message = error instanceof Error ? error.message : "The collection provider did not answer.";
    return { ok: false, error: `${message} Nothing was charged.` };
  }
}

/** Holding and operations account ids for a connected-account collection route. */
export async function routeHoldingAccounts(providerCode: string | null | undefined) {
  if (!isConnectedAccountCollectionProvider(providerCode)) {
    return { holdingAccountId: "", operationsAccountId: "" };
  }
  const { loadAirwallexConfig } = await import("@/lib/providers/airwallex-config");
  const settings = await loadAirwallexConfig();
  return {
    holdingAccountId: settings?.holdingAccountId ?? "",
    operationsAccountId: settings?.operationsAccountId ?? "",
  };
}
