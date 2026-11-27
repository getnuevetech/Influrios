/** Wallet passes for the Influrios Card: build, download and keep saved passes up to date. */
import { prisma } from "@/lib/db";
import { buildApplePass, pushApplePassUpdate } from "@/lib/wallet/apple";
import { walletCardFor } from "@/lib/wallet/card";
import { getAppleWalletConfig, getGoogleWalletConfig } from "@/lib/wallet/config";
import { googleSaveUrl, updateGooglePass } from "@/lib/wallet/google";

export async function applePassFor(slug: string) {
  const [card, config] = await Promise.all([walletCardFor(slug), getAppleWalletConfig()]);
  if (!card) return { ok: false as const, status: 404, error: "This card is not available." };
  if (!config) return { ok: false as const, status: 503, error: "Apple Wallet is not set up yet." };
  try {
    return { ok: true as const, bytes: await buildApplePass(card, config), card };
  } catch (error) {
    console.error("apple wallet pass", error);
    return { ok: false as const, status: 500, error: "The Apple Wallet pass could not be created. Check the pass certificate in Admin → Wallet passes." };
  }
}

export async function googleSaveLinkFor(slug: string) {
  const [card, config] = await Promise.all([walletCardFor(slug), getGoogleWalletConfig()]);
  if (!card) return { ok: false as const, status: 404, error: "This card is not available." };
  if (!config) return { ok: false as const, status: 503, error: "Google Wallet is not set up yet." };
  try {
    return { ok: true as const, url: googleSaveUrl(card, config) };
  } catch (error) {
    console.error("google wallet link", error);
    return { ok: false as const, status: 500, error: "The Google Wallet link could not be created. Check the service account key in Admin → Wallet passes." };
  }
}

/**
 * After an influencer edits their card: tell iPhones to fetch the new pass and update the Google pass.
 * Never throws; a wallet problem must not block saving a profile.
 */
export async function refreshWalletPasses(slug: string) {
  try {
    const card = await walletCardFor(slug);
    if (!card) return;
    const [apple, google] = await Promise.all([getAppleWalletConfig(), getGoogleWalletConfig()]);
    if (apple) {
      const devices = await prisma.walletPassRegistration.findMany({
        where: { serialNumber: card.serial, passTypeIdentifier: apple.passTypeIdentifier },
        select: { pushToken: true },
      });
      await pushApplePassUpdate([...new Set(devices.map((row) => row.pushToken))], apple).catch((error) =>
        console.error("apple wallet push", error),
      );
    }
    if (google) await updateGooglePass(card, google).catch((error) => console.error("google wallet update", error));
  } catch (error) {
    console.error("wallet refresh", error);
  }
}
