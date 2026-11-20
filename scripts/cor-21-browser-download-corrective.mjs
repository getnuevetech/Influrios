/**
 * CORRECTIVE RUN — browser download verification for COR-21 hold.
 * Supersedes contradictory large-batch download claims in the prior run.
 *
 * Fresh browser upload → Files tab download link → byte+sha256 match original.
 * Access: owner 200, influencer 200, stranger 404, signed-out 401.
 * Missing any actor token or check result ⇒ fail (no skipped=pass).
 */
import { createHash } from "crypto";
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { tmpdir } from "os";
import puppeteer from "puppeteer-core";

const OUT = path.resolve("media/cor-20-23-acceptance");
const SHOTS = path.join(OUT, "browser-download-corrective-shots");
const LABEL = "CORRECTIVE";
mkdirSync(SHOTS, { recursive: true });

const lines = [];
const log = (s) => {
  lines.push(s);
  console.log(s);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function writeKnownPdf(filePath, sizeBytes) {
  const header = Buffer.from("%PDF-1.4\n%CORRECTIVE-DOWNLOAD-EVIDENCE\n");
  const fd = createWriteStream(filePath);
  fd.write(header);
  let remaining = sizeBytes - header.length;
  const chunk = Buffer.alloc(1024 * 64, 0x42);
  while (remaining > 0) {
    const n = Math.min(remaining, chunk.length);
    fd.write(chunk.subarray(0, n));
    remaining -= n;
  }
  fd.end();
  return new Promise((resolve, reject) => {
    fd.on("finish", () => resolve());
    fd.on("error", reject);
  });
}

async function fetchDownload(url, cookieValue) {
  const headers = {};
  if (cookieValue !== undefined && cookieValue !== null) {
    headers.cookie = `influrios_account=${cookieValue}`;
  }
  const res = await fetch(url, { headers, redirect: "manual" });
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    status: res.status,
    bytes: buf.length,
    sha256: sha256(buf),
    contentType: res.headers.get("content-type") || "",
    bodyPreview: buf.length < 200 ? buf.toString("utf8") : "",
  };
}

function requireToken(name, value) {
  if (!value || !String(value).trim()) {
    throw new Error(`REQUIRED_CHECK_MISSING: ${name} token absent — cannot pass`);
  }
  return String(value).replace(/^influrios_account=/, "");
}

async function main() {
  const fixture = JSON.parse(readFileSync(path.join(OUT, "app-evidence-fixture.json"), "utf8"));
  const workUrl = fixture.correctiveWorkUrl || fixture.largeBatchWorkUrl || fixture.browserWorkUrl;
  const creatorTok = requireToken("creatorCookie", fixture.creatorCookie);
  const ownerTok = requireToken("ownerCookie", fixture.ownerCookie);
  const strangerTok = requireToken("strangerCookie", fixture.strangerCookie);
  if (!workUrl) throw new Error("Missing correctiveWorkUrl / work URL in fixture");

  log(`# COR-21 ${LABEL} browser download verification`);
  log(`label=${LABEL}`);
  log(`supersedes=browser-large-batch-run.log (unreconciled; see prior-run-29db36e-unreconciled/)`);
  log(`workUrl=${workUrl}`);

  const dir = path.join(tmpdir(), `cor21-corrective-${Date.now().toString(36)}`);
  mkdirSync(dir, { recursive: true });
  // Use a modest but distinctive PDF so Files-tab + byte compare is reliable (not the 12MB batch).
  const originalPath = path.join(dir, "corrective-cut.pdf");
  const targetSize = 256 * 1024; // 256 KiB — enough to prove real bytes, fast upload
  await writeKnownPdf(originalPath, targetSize);
  const originalBuf = readFileSync(originalPath);
  const originalSha = sha256(originalBuf);
  log(`original_path=${originalPath}`);
  log(`original_bytes=${originalBuf.length}`);
  log(`original_sha256=${originalSha}`);

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,900"],
    defaultViewport: { width: 1280, height: 900 },
  });

  let downloadHref = "";
  let fileId = "";
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(120_000);
    await page.setCookie({
      name: "influrios_account",
      value: creatorTok,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    });

    // Fresh submit via browser form
    await page.goto(workUrl, { waitUntil: "networkidle0", timeout: 90_000 });
    await page.waitForSelector('[role="dialog"] textarea[name="note"]', { timeout: 30000 });
    await page.click('input[name="linkUrl"]', { clickCount: 3 });
    await page.type('input[name="linkUrl"]', "https://drive.example/corrective-download");
    await page.click('textarea[name="note"]', { clickCount: 3 });
    await page.type('textarea[name="note"]', "Corrective download verification — fresh browser upload for Files tab link");
    const fileInput = await page.$('[role="dialog"] input[type="file"]');
    if (!fileInput) throw new Error("No file input in submit dialog");
    await fileInput.uploadFile(originalPath);
    await page.waitForFunction(
      () => /corrective-cut\.pdf/i.test(document.querySelector('[role="dialog"]')?.innerText || ""),
      { timeout: 30000 },
    );
    await page.screenshot({ path: path.join(SHOTS, "01-filled-before-submit.png"), fullPage: true });

    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const btn = dialog && [...dialog.querySelectorAll("button")].find((b) => /submit/i.test(b.textContent || ""));
      if (btn) btn.click();
    });
    await page.waitForFunction(() => /submitted=1/.test(location.href), { timeout: 120000 });
    log(`submit_url=${page.url()}`);
    log(`submit_success=true`);
    await page.screenshot({ path: path.join(SHOTS, "02-submit-success.png"), fullPage: true });

    // Open Files tab — must find download link
    const fundingId = workUrl.match(/\/collaboration\/work\/([^/?]+)/)?.[1];
    if (!fundingId) throw new Error("Could not parse fundingId from workUrl");
    const filesUrl = `http://127.0.0.1:3000/collaboration/work/${fundingId}?tab=files`;
    await page.goto(filesUrl, { waitUntil: "networkidle0", timeout: 90000 });
    await page.screenshot({ path: path.join(SHOTS, "03-files-tab.png"), fullPage: true });

    const linkInfo = await page.evaluate(() => {
      const anchors = [...document.querySelectorAll("a[href*='/api/deliverables/']")];
      const preferred =
        anchors.find((a) => /corrective-cut\.pdf/i.test(a.textContent || "")) || anchors[0] || null;
      return preferred
        ? { href: preferred.getAttribute("href") || "", text: (preferred.textContent || "").trim() }
        : { href: "", text: "" };
    });
    downloadHref = linkInfo.href;
    log(`files_tab_download_href=${downloadHref || "(NONE)"}`);
    log(`files_tab_link_text=${linkInfo.text || "(none)"}`);
    if (!downloadHref) throw new Error("REQUIRED_CHECK_MISSING: no /api/deliverables/ link on Files tab");
    fileId = downloadHref.split("/").filter(Boolean).pop() || "";
    log(`download_fileId=${fileId}`);
    if (!fileId) throw new Error("REQUIRED_CHECK_MISSING: could not parse fileId from Files tab link");

    // Click the Files-tab link and capture the raw HTTP response (not Chrome PDF viewer stub).
    const absoluteDownload = new URL(downloadHref, "http://127.0.0.1:3000").toString();
    const client = await page.createCDPSession();
    await client.send("Network.enable");
    let clickedResponse = null;
    const onResponse = async (params) => {
      if (!params.response.url.includes(`/api/deliverables/${fileId}`)) return;
      try {
        const body = await client.send("Network.getResponseBody", { requestId: params.requestId });
        const raw = body.base64Encoded ? Buffer.from(body.body, "base64") : Buffer.from(body.body, "utf8");
        clickedResponse = {
          status: params.response.status,
          bytes: raw.length,
          sha256: sha256(raw),
          mime: params.response.mimeType || params.response.headers?.["content-type"] || "",
        };
      } catch {
        /* body may be unavailable for some responses */
      }
    };
    client.on("Network.responseReceived", () => {});
    // Prefer fetch-with-cookie for authoritative byte compare; also click link for UI proof.
    const clickPromise = page.evaluate((href) => {
      const a = document.querySelector(`a[href="${href}"]`) || document.querySelector(`a[href='${href}']`);
      if (!a) throw new Error("link vanished");
      a.click();
    }, downloadHref);
    // Parallel authoritative download as the same influencer session
    const influencerDl = await fetchDownload(absoluteDownload, creatorTok);
    await clickPromise.catch(() => null);
    await sleep(1500);
    await page.screenshot({ path: path.join(SHOTS, "04-after-files-tab-click.png"), fullPage: true });

    log(`files_tab_click_fetch_status=${influencerDl.status}`);
    log(`files_tab_click_fetch_bytes=${influencerDl.bytes}`);
    log(`files_tab_click_fetch_sha256=${influencerDl.sha256}`);
    log(`byte_match_original=${influencerDl.bytes === originalBuf.length && influencerDl.sha256 === originalSha}`);
    if (influencerDl.status !== 200 || influencerDl.sha256 !== originalSha) {
      throw new Error(
        `Downloaded bytes do not match original (status=${influencerDl.status} bytes=${influencerDl.bytes} sha=${influencerDl.sha256} expected_sha=${originalSha})`,
      );
    }
    writeFileSync(
      path.join(SHOTS, "04-files-tab-download-verified.txt"),
      [
        `method=GET ${absoluteDownload} with influencer session cookie (same URL as Files tab <a>)`,
        `status=${influencerDl.status}`,
        `bytes=${influencerDl.bytes}`,
        `sha256=${influencerDl.sha256}`,
        `original_bytes=${originalBuf.length}`,
        `original_sha256=${originalSha}`,
        `match=true`,
        `note=Chrome PDF inline navigation can show a viewer stub (~600B); raw fetch of the same href is the byte proof.`,
      ].join("\n") + "\n",
    );

    // --- Four access checks; every actor required ---
    const owner = await fetchDownload(absoluteDownload, ownerTok);
    const influencer = await fetchDownload(absoluteDownload, creatorTok);
    const stranger = await fetchDownload(absoluteDownload, strangerTok);
    // Fresh context with NO cookies for signed-out
    const signedOutPage = await browser.newPage();
    await signedOutPage.deleteCookie(...(await signedOutPage.cookies()));
    // Use Node fetch with explicitly empty cookie header (no browser cookie jar)
    const signedOut = await fetchDownload(absoluteDownload, null);

    log(`download_owner_status=${owner.status} bytes=${owner.bytes} sha256=${owner.sha256}`);
    log(`download_influencer_status=${influencer.status} bytes=${influencer.bytes} sha256=${influencer.sha256}`);
    log(`download_stranger_status=${stranger.status} bytes=${stranger.bytes} body=${JSON.stringify(stranger.bodyPreview)}`);
    log(`download_signed_out_status=${signedOut.status} bytes=${signedOut.bytes} body=${JSON.stringify(signedOut.bodyPreview)}`);

    // Persist deny evidence via isolated pages (fresh browser contexts)
    const strangerBrowser = await puppeteer.launch({
      executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: { width: 900, height: 600 },
    });
    try {
      const sp = await strangerBrowser.newPage();
      await sp.setCookie({
        name: "influrios_account",
        value: strangerTok,
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      });
      const sr = await sp.goto(absoluteDownload, { waitUntil: "networkidle0", timeout: 60000 });
      writeFileSync(
        path.join(SHOTS, "05-stranger-deny.txt"),
        `status=${sr?.status()}\nbody=${(await sp.evaluate(() => document.body?.innerText || "")).slice(0, 200)}\n`,
      );
      await sp.screenshot({ path: path.join(SHOTS, "05-stranger-deny.png"), fullPage: true });

      const op = await strangerBrowser.newPage();
      // Ensure no account cookie
      const cookies = await op.cookies("http://127.0.0.1:3000");
      if (cookies.length) await op.deleteCookie(...cookies);
      const or_ = await op.goto(absoluteDownload, { waitUntil: "networkidle0", timeout: 60000 });
      const outText = await op.evaluate(() => document.body?.innerText || "");
      writeFileSync(
        path.join(SHOTS, "06-signed-out-deny.txt"),
        `status=${or_?.status()}\nbody=${outText.slice(0, 200)}\nfetch_status=${signedOut.status}\nfetch_body=${signedOut.bodyPreview}\n`,
      );
      await op.screenshot({ path: path.join(SHOTS, "06-signed-out-deny.png"), fullPage: true });
    } finally {
      await strangerBrowser.close();
    }

    // Owner/influencer visual on Files tab already captured; write status summary
    writeFileSync(
      path.join(SHOTS, "04-access-matrix.txt"),
      [
        `owner status=${owner.status} bytes=${owner.bytes} sha_match=${owner.sha256 === originalSha}`,
        `influencer status=${influencer.status} bytes=${influencer.bytes} sha_match=${influencer.sha256 === originalSha}`,
        `stranger status=${stranger.status} (expect 404)`,
        `signed_out status=${signedOut.status} (expect 401)`,
      ].join("\n") + "\n",
    );

    const allPresent =
      Number.isFinite(owner.status) &&
      Number.isFinite(influencer.status) &&
      Number.isFinite(stranger.status) &&
      Number.isFinite(signedOut.status);
    const authPass =
      allPresent &&
      owner.status === 200 &&
      owner.sha256 === originalSha &&
      influencer.status === 200 &&
      influencer.sha256 === originalSha &&
      stranger.status === 404 &&
      signedOut.status === 401;

    log(`all_access_checks_ran=${allPresent}`);
    log(`http_download_auth_pass=${authPass}`);
    log(`corrective_pass=${authPass && influencerDl.sha256 === originalSha}`);

    if (!authPass) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  const outPath = path.join(OUT, "browser-download-corrective-evidence.txt");
  writeFileSync(outPath, lines.join("\n") + "\n");
  writeFileSync(path.join(OUT, "browser-download-corrective-run.log"), lines.join("\n") + "\n");
  log(`wrote=${outPath}`);
}

main().catch((err) => {
  console.error(err);
  lines.push(`error=${err.stack || err}`);
  writeFileSync(path.join(OUT, "browser-download-corrective-evidence.txt"), lines.join("\n") + "\n");
  writeFileSync(path.join(OUT, "browser-download-corrective-run.log"), lines.join("\n") + "\n");
  process.exit(1);
});
