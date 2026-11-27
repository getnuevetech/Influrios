import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "crypto";
import { execFileSync } from "child_process";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { describe, it } from "node:test";
import forge from "node-forge";
import { applePassJson, passManifest, signManifest } from "@/lib/wallet/apple";
import { appleConfigComplete, googleConfigComplete } from "@/lib/wallet/config";
import { googleIds, googlePassObject, googleSaveUrl } from "@/lib/wallet/google";
import type { WalletCard } from "@/lib/wallet/card";
import { zipStore } from "@/lib/wallet/zip";

const card: WalletCard = {
  serial: "cmcreator123",
  slug: "emily-chen",
  name: "Emily Chen",
  title: "Lifestyle Creator",
  specialties: "Beauty · Skincare",
  location: "Austin, TX, US",
  cardUrl: "https://inflr.me/emily",
  cardLabel: "inflr.me/emily",
  profileUrl: "https://influrios.com/c/emily-chen",
  photoUrl: "https://influrios.com/uploads/emily.jpg",
  socials: [{ label: "Instagram", value: "@emily · 12K" }],
  updatedAt: new Date("2026-11-01T00:00:00Z"),
};

function selfSignedPem(cn: string) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 86_400_000 * 365);
  cert.setSubject([{ name: "commonName", value: cn }]);
  cert.setIssuer([{ name: "commonName", value: cn }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return { certificatePem: forge.pki.certificateToPem(cert), privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey) };
}

describe("wallet passes", () => {
  it("encodes the card link in the Apple pass QR and includes the update service", () => {
    const json = applePassJson(card, { passTypeIdentifier: "pass.com.influrios.card", teamIdentifier: "ABCDE12345" }, "https://influrios.com");
    assert.equal(json.barcodes[0].message, "https://inflr.me/emily");
    assert.equal(json.barcodes[0].format, "PKBarcodeFormatQR");
    assert.equal(json.serialNumber, "cmcreator123");
    assert.equal(json.webServiceURL, "https://influrios.com/api/wallet/apple");
    assert.ok(json.authenticationToken && json.authenticationToken.length >= 16);
    assert.equal(json.generic.primaryFields[0].value, "Emily Chen");
    const local = applePassJson(card, { passTypeIdentifier: "pass.x", teamIdentifier: "ABCDE12345" }, "http://localhost:3000");
    assert.equal("webServiceURL" in local, false);
  });

  it("writes a zip that unzip can read", () => {
    const zip = zipStore([
      { name: "pass.json", data: Buffer.from("{}") },
      { name: "icon.png", data: Buffer.from([1, 2, 3]) },
    ]);
    const dir = mkdtempSync(path.join(tmpdir(), "pkpass-"));
    writeFileSync(path.join(dir, "t.zip"), zip);
    const listing = execFileSync("python3", ["-c", "import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip());print(','.join(z.namelist()))", path.join(dir, "t.zip")]).toString();
    assert.match(listing, /^None\npass\.json,icon\.png/);
  });

  it("signs the manifest so OpenSSL verifies it against the pass certificate", () => {
    const signer = selfSignedPem("Pass Type ID: pass.com.influrios.card");
    const wwdr = selfSignedPem("Apple Worldwide Developer Relations");
    const manifest = passManifest([{ name: "pass.json", data: Buffer.from('{"a":1}') }]);
    const signature = signManifest(manifest, { ...signer, privateKeyPassphrase: "", wwdrPem: wwdr.certificatePem });
    const dir = mkdtempSync(path.join(tmpdir(), "pkpass-sig-"));
    writeFileSync(path.join(dir, "manifest.json"), manifest);
    writeFileSync(path.join(dir, "signature"), signature);
    writeFileSync(path.join(dir, "signer.pem"), signer.certificatePem);
    const out = execFileSync(
      "openssl",
      ["cms", "-verify", "-binary", "-inform", "DER", "-in", path.join(dir, "signature"), "-content", path.join(dir, "manifest.json"), "-noverify", "-certfile", path.join(dir, "signer.pem"), "-out", "/dev/null"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    assert.ok(out !== undefined);
    const certs = execFileSync("openssl", ["pkcs7", "-inform", "DER", "-in", path.join(dir, "signature"), "-print_certs", "-noout"]).toString();
    assert.match(certs, /Pass Type ID/);
    assert.match(certs, /Apple Worldwide Developer Relations/);
  });

  it("builds a signed Save to Google Wallet link with the card QR", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const config = {
      issuerId: "3388000000012345678",
      serviceAccountEmail: "wallet@influrios.iam.gserviceaccount.com",
      privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    };
    const url = googleSaveUrl(card, config, "https://influrios.com");
    assert.match(url, /^https:\/\/pay\.google\.com\/gp\/v\/save\//);
    const [header, body, sig] = url.split("/save/")[1].split(".");
    const ok = createVerify("RSA-SHA256").update(`${header}.${body}`).verify(publicKey, Buffer.from(sig, "base64url"));
    assert.equal(ok, true);
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    assert.equal(payload.typ, "savetowallet");
    assert.equal(payload.aud, "google");
    const object = payload.payload.genericObjects[0];
    assert.equal(object.barcode.value, "https://inflr.me/emily");
    assert.equal(object.id, googleIds(card, config.issuerId).objectId);
    assert.equal(object.classId, "3388000000012345678.influrios_card");
    assert.equal(object.header.defaultValue.value, "Emily Chen");
    assert.equal(googlePassObject({ ...card, photoUrl: null }, config.issuerId).heroImage, undefined);
  });

  it("only treats complete credentials as ready", () => {
    assert.equal(appleConfigComplete({ passTypeIdentifier: "pass.x", teamIdentifier: "ABCDE12345" }), false);
    assert.equal(googleConfigComplete({ issuerId: "123", serviceAccountEmail: "a@b", privateKeyPem: "-----BEGIN PRIVATE KEY-----" }), false);
    assert.equal(googleConfigComplete({ issuerId: "3388000000012345678", serviceAccountEmail: "a@b", privateKeyPem: "-----BEGIN PRIVATE KEY-----" }), true);
  });
});
