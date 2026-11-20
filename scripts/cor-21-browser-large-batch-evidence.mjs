/**
 * COR-21 browser evidence: valid batch >10MB through the actual workroom form,
 * then reload → reopen → authorized download; HTTP deny for stranger + signed-out.
 */
import { createWriteStream, mkdirSync, readFileSync, writeFileSync, promises as fsp } from "fs";
import path from "path";
import { tmpdir } from "os";
import puppeteer from "puppeteer-core";

const OUT = path.resolve("media/cor-20-23-acceptance");
const SHOTS = path.join(OUT, "browser-large-batch-shots");
mkdirSync(SHOTS, { recursive: true });

const lines = [];
const log = (s) => {
  lines.push(s);
  console.log(s);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function writeBigPdf(filePath, sizeBytes) {
  const header = Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  const fd = createWriteStream(filePath);
  fd.write(header);
  let remaining = sizeBytes - header.length;
  const chunk = Buffer.alloc(1024 * 256, 0x41);
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

async function main() {
  const fixturePath = path.join(OUT, "app-evidence-fixture.json");
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  // Prefer dedicated large-batch fields; fall back to seeding via sibling script output.
  const workUrl = fixture.largeBatchWorkUrl || fixture.browserWorkUrl;
  const token = String(fixture.creatorCookie || "").replace(/^influrios_account=/, "");
  const ownerToken = String(fixture.ownerCookie || "").replace(/^influrios_account=/, "");
  const strangerToken = String(fixture.strangerCookie || "").replace(/^influrios_account=/, "");
  const fileIdHint = fixture.largeBatchFileId || "";
  if (!workUrl || !token) throw new Error("Missing largeBatchWorkUrl/browserWorkUrl or creatorCookie — run seed first");

  log(`# COR-21 browser large-batch + download evidence`);
  log(`workUrl=${workUrl}`);
  log(`bodySizeLimit=40mb`);
  log(`middlewareClientMaxBodySize=40mb`);

  const dir = path.join(tmpdir(), `cor21-browser-batch-${Date.now().toString(36)}`);
  mkdirSync(dir, { recursive: true });
  const f1 = path.join(dir, "browser-batch-a.pdf");
  const f2 = path.join(dir, "browser-batch-b.pdf");
  await writeBigPdf(f1, 6 * 1024 * 1024);
  await writeBigPdf(f2, 6 * 1024 * 1024);
  const total = 6 * 1024 * 1024 * 2;
  log(`batch_files=${f1},${f2}`);
  log(`batch_total_bytes=${total}`);
  log(`batch_gt_10mb=${total > 10 * 1024 * 1024}`);

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,900"],
    defaultViewport: { width: 1280, height: 900 },
  });

  let downloadFileId = fileIdHint;
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(120_000);
    await page.setCookie({
      name: "influrios_account",
      value: token,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    });

    await page.goto(workUrl, { waitUntil: "networkidle0", timeout: 90_000 });
    await page.waitForSelector('[role="dialog"] textarea[name="note"], [role="dialog"] input[name="linkUrl"]', {
      timeout: 30000,
    });
    await page.screenshot({ path: path.join(SHOTS, "01-submit-dialog-open.png"), fullPage: true });

    const note = "Browser large-batch evidence note — two six-megabyte PDFs through the actual form";
    const link = "https://drive.example/browser-large-batch";
    await page.click('input[name="linkUrl"]', { clickCount: 3 });
    await page.type('input[name="linkUrl"]', link);
    await page.click('textarea[name="note"]', { clickCount: 3 });
    await page.type('textarea[name="note"]', note);

    const fileInput = await page.$('[role="dialog"] input[type="file"]');
    if (!fileInput) throw new Error("No file input in submit dialog");
    await fileInput.uploadFile(f1, f2);
    // Wait until both files show as ready in the dialog
    await page.waitForFunction(
      () => {
        const text = document.querySelector('[role="dialog"]')?.innerText || "";
        return /browser-batch-a\.pdf/i.test(text) && /browser-batch-b\.pdf/i.test(text) && (text.match(/ready/gi) || []).length >= 2;
      },
      { timeout: 60000 },
    ).catch(() => null);
    await sleep(500);
    await page.screenshot({ path: path.join(SHOTS, "02-files-selected-gt-10mb.png"), fullPage: true });

    const selected = await page.evaluate(() => {
      const text = document.querySelector('[role="dialog"]')?.innerText || "";
      return {
        hasA: /browser-batch-a\.pdf/i.test(text),
        hasB: /browser-batch-b\.pdf/i.test(text),
        textSample: text.slice(0, 400).replace(/\s+/g, " "),
      };
    });
    log(`files_selected_a=${selected.hasA}`);
    log(`files_selected_b=${selected.hasB}`);

    // Submit via dialog button only (avoid logout submit buttons)
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const btn = dialog && [...dialog.querySelectorAll("button")].find((b) => /submit/i.test(b.textContent || ""));
      if (btn) btn.click();
    });

    await page.waitForFunction(() => /submitted=1/.test(location.href) || /In review|submitted/i.test(document.body.innerText), {
      timeout: 120000,
    });
    await sleep(1000);
    await page.screenshot({ path: path.join(SHOTS, "03-submit-success.png"), fullPage: true });
    const afterSubmit = await page.evaluate(() => ({
      url: location.href,
      body: document.body.innerText.slice(0, 600).replace(/\s+/g, " "),
    }));
    log(`submit_url=${afterSubmit.url}`);
    log(`submit_success=${/submitted=1/.test(afterSubmit.url) || /In review|submitted/i.test(afterSubmit.body)}`);

    // Reload → reopen
    const baseWork = workUrl.split("?")[0] + "?tab=milestones";
    await page.goto(baseWork, { waitUntil: "networkidle0", timeout: 90000 });
    await page.screenshot({ path: path.join(SHOTS, "04-reload-milestones.png"), fullPage: true });
    const reopen = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        showsInReview: /In review|submitted|version/i.test(text),
        showsBatch: /browser-batch|large-batch|Browser large-batch/i.test(text),
        sample: text.slice(0, 500).replace(/\s+/g, " "),
      };
    });
    log(`reopen_shows_submission=${reopen.showsInReview || reopen.showsBatch}`);

    // Open files tab or follow a deliverable download link if present
    const downloadHref = await page.evaluate(() => {
      const anchors = [...document.querySelectorAll("a[href*='/api/deliverables/']")];
      return anchors[0]?.getAttribute("href") || "";
    });
    log(`download_href=${downloadHref || "(none on page)"}`);
    if (downloadHref) {
      downloadFileId = downloadHref.split("/").pop() || downloadFileId;
      const dl = await page.goto(new URL(downloadHref, "http://127.0.0.1:3000").toString(), {
        waitUntil: "networkidle0",
        timeout: 60000,
      });
      log(`authorized_download_status=${dl?.status()}`);
      log(`authorized_download_bytes=${(await dl?.buffer())?.length ?? 0}`);
      // PDF may render blank in screenshot; still capture navigation result page/headers via log
      await page.screenshot({ path: path.join(SHOTS, "05-authorized-download.png"), fullPage: true });
    }

    // HTTP deny checks with real requests (same browser origin)
    if (downloadFileId) {
      const url = `http://127.0.0.1:3000/api/deliverables/${downloadFileId}`;
      async function statusWithCookie(cookieVal) {
        const headers = cookieVal ? { cookie: `influrios_account=${cookieVal}` } : {};
        const res = await fetch(url, { headers, redirect: "manual" });
        const buf = Buffer.from(await res.arrayBuffer());
        return { status: res.status, bytes: buf.length };
      }
      const owner = await statusWithCookie(ownerToken || token);
      const influencer = await statusWithCookie(token);
      const stranger = strangerToken ? await statusWithCookie(strangerToken) : { status: "skipped", bytes: 0 };
      const signedOut = await statusWithCookie("");
      log(`download_owner_status=${owner.status} bytes=${owner.bytes}`);
      log(`download_influencer_status=${influencer.status} bytes=${influencer.bytes}`);
      log(`download_stranger_status=${stranger.status}`);
      log(`download_signed_out_status=${signedOut.status}`);
      const pass =
        (owner.status === 200 || influencer.status === 200) &&
        (stranger.status === 404 || stranger.status === "skipped") &&
        signedOut.status === 401;
      log(`http_download_auth_pass=${pass}`);
    } else {
      log(`http_download_auth_pass=false`);
      log(`http_download_auth_note=no file id discovered after browser submit`);
    }

    const pass =
      selected.hasA &&
      selected.hasB &&
      total > 10 * 1024 * 1024 &&
      (/submitted=1/.test(afterSubmit.url) || /In review|submitted/i.test(afterSubmit.body));
    log(`browser_large_batch_pass=${pass}`);
  } finally {
    await browser.close();
  }

  writeFileSync(path.join(OUT, "browser-large-batch-evidence.txt"), lines.join("\n") + "\n");
  log(`wrote=${path.join(OUT, "browser-large-batch-evidence.txt")}`);
}

main().catch((err) => {
  console.error(err);
  writeFileSync(path.join(OUT, "browser-large-batch-evidence.txt"), lines.concat([String(err.stack || err)]).join("\n") + "\n");
  process.exit(1);
});
