/**
 * Apple Wallet (.pkpass): pass.json + images + manifest.json (SHA-1 of each file) + a detached PKCS#7
 * signature of the manifest made with the Pass Type ID certificate, including Apple's WWDR certificate.
 */
import { createHash } from "crypto";
import forge from "node-forge";
import { appOrigin } from "@/lib/creator-og";
import { applePassAuthToken, brandMarkSvg, photoPng, pngFromSvg, WALLET_COLORS, wordmarkSvg, type WalletCard } from "@/lib/wallet/card";
import type { AppleWalletConfig } from "@/lib/wallet/config";
import { zipStore } from "@/lib/wallet/zip";

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

export const APPLE_WEB_SERVICE_PATH = "/api/wallet/apple";

export function applePassJson(card: WalletCard, config: Pick<AppleWalletConfig, "passTypeIdentifier" | "teamIdentifier">, origin = appOrigin()) {
  return {
    formatVersion: 1,
    passTypeIdentifier: config.passTypeIdentifier,
    teamIdentifier: config.teamIdentifier,
    serialNumber: card.serial,
    organizationName: "Influrios",
    description: `${card.name} · Influrios Card`,
    logoText: "Influrios Card",
    foregroundColor: rgb(WALLET_COLORS.foreground),
    backgroundColor: rgb(WALLET_COLORS.background),
    labelColor: rgb(WALLET_COLORS.label),
    // Only a public https origin can receive update requests from iPhones.
    ...(origin.startsWith("https://")
      ? { webServiceURL: `${origin}${APPLE_WEB_SERVICE_PATH}`, authenticationToken: applePassAuthToken(card.serial) }
      : {}),
    sharingProhibited: false,
    generic: {
      primaryFields: [{ key: "name", label: card.title.toUpperCase(), value: card.name }],
      secondaryFields: [
        ...(card.specialties ? [{ key: "specialty", label: "SPECIALTY", value: card.specialties }] : []),
        ...(card.location ? [{ key: "location", label: "BASED IN", value: card.location }] : []),
      ],
      auxiliaryFields: card.socials.slice(0, 2).map((row, index) => ({ key: `social${index}`, label: row.label.toUpperCase(), value: row.value })),
      backFields: [
        { key: "card", label: "Influrios Card", value: card.cardUrl, attributedValue: `<a href="${card.cardUrl}">${card.cardLabel}</a>` },
        ...card.socials.map((row, index) => ({ key: `back_social${index}`, label: row.label, value: row.value })),
        {
          key: "about",
          label: "About",
          value: "Scan the code or open the link to see this influencer's card, socials and collaboration details on Influrios.",
        },
      ],
    },
    barcodes: [{ format: "PKBarcodeFormatQR", message: card.cardUrl, messageEncoding: "iso-8859-1", altText: card.cardLabel }],
    barcode: { format: "PKBarcodeFormatQR", message: card.cardUrl, messageEncoding: "iso-8859-1", altText: card.cardLabel },
  };
}

async function passImages(card: WalletCard) {
  const files: { name: string; data: Buffer }[] = [];
  for (const [suffix, scale] of [["", 1], ["@2x", 2], ["@3x", 3]] as const) {
    files.push({ name: `icon${suffix}.png`, data: await pngFromSvg(brandMarkSvg(29 * scale), 29 * scale) });
    files.push({ name: `logo${suffix}.png`, data: await pngFromSvg(wordmarkSvg(50 * scale), 160 * scale, 50 * scale) });
  }
  for (const [suffix, scale] of [["", 1], ["@2x", 2], ["@3x", 3]] as const) {
    const photo = await photoPng(card.photoUrl, 90 * scale);
    if (photo) files.push({ name: `thumbnail${suffix}.png`, data: photo });
  }
  return files;
}

export function passManifest(files: { name: string; data: Buffer }[]) {
  const manifest: Record<string, string> = {};
  for (const file of files) manifest[file.name] = createHash("sha1").update(file.data).digest("hex");
  return Buffer.from(JSON.stringify(manifest));
}

/** Detached PKCS#7 (DER) signature of the manifest. */
export function signManifest(manifest: Buffer, config: Pick<AppleWalletConfig, "certificatePem" | "privateKeyPem" | "privateKeyPassphrase" | "wwdrPem">) {
  const certificate = forge.pki.certificateFromPem(config.certificatePem);
  const wwdr = forge.pki.certificateFromPem(config.wwdrPem);
  const key = config.privateKeyPassphrase
    ? forge.pki.decryptRsaPrivateKey(config.privateKeyPem, config.privateKeyPassphrase)
    : forge.pki.privateKeyFromPem(config.privateKeyPem);
  if (!key) throw new Error("The pass certificate's private key could not be opened. Check the passphrase.");
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifest.toString("binary"));
  p7.addCertificate(certificate);
  p7.addCertificate(wwdr);
  p7.addSigner({
    key,
    certificate,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  });
  p7.sign({ detached: true });
  return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), "binary");
}

export async function buildApplePass(card: WalletCard, config: AppleWalletConfig) {
  const files = [{ name: "pass.json", data: Buffer.from(JSON.stringify(applePassJson(card, config))) }, ...(await passImages(card))];
  const manifest = passManifest(files);
  const signature = signManifest(manifest, config);
  return zipStore([...files, { name: "manifest.json", data: manifest }, { name: "signature", data: signature }]);
}

/**
 * Tell iPhones that hold this pass to fetch the new version (APNs, HTTP/2, authenticated with the pass certificate).
 * Returns how many devices accepted the push.
 */
export async function pushApplePassUpdate(pushTokens: string[], config: AppleWalletConfig) {
  if (pushTokens.length === 0) return 0;
  const http2 = await import("http2");
  const client = http2.connect("https://api.push.apple.com", {
    cert: config.certificatePem,
    key: config.privateKeyPem,
    ...(config.privateKeyPassphrase ? { passphrase: config.privateKeyPassphrase } : {}),
  });
  let accepted = 0;
  try {
    await Promise.all(
      pushTokens.map(
        (token) =>
          new Promise<void>((resolve) => {
            const request = client.request({
              ":method": "POST",
              ":path": `/3/device/${token}`,
              "apns-topic": config.passTypeIdentifier,
              "content-type": "application/json",
            });
            request.setTimeout(8000, () => {
              request.close();
              resolve();
            });
            request.on("response", (headers) => {
              if (headers[":status"] === 200) accepted += 1;
            });
            request.on("error", () => resolve());
            request.on("close", () => resolve());
            request.end("{}");
          }),
      ),
    );
  } finally {
    client.close();
  }
  return accepted;
}
