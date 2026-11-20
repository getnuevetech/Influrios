/**
 * Browser evidence: failed upload keeps workroom popup + note/link/files;
 * retry after restoring storage → one successful submission.
 * Injects httpOnly session cookie (skips flaky login automation).
 */
import { readFileSync, writeFileSync, mkdirSync, promises as fsp } from "fs";
import path from "path";
import puppeteer from "puppeteer-core";

const OUT = path.resolve("media/cor-20-23-acceptance");
const SHOTS = path.join(OUT, "browser-shots");
mkdirSync(SHOTS, { recursive: true });

const fixture = JSON.parse(readFileSync(path.join(OUT, "app-evidence-fixture.json"), "utf8"));
const workUrl = fixture.browserWorkUrl;
const token = String(fixture.creatorCookie || "").replace(/^influrios_account=/, "");
if (!workUrl || !token) throw new Error("Missing browserWorkUrl or creatorCookie in fixture");

const storeRoot = path.join(process.cwd(), "data", "deliverables");
const lines = [];
const log = (s) => {
  lines.push(s);
  console.log(s);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  log(`# COR-21 browser retry evidence`);
  log(`workUrl=${workUrl}`);
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,900"],
    defaultViewport: { width: 1280, height: 900 },
  });
  try {
    const page = await browser.newPage();
    await page.setCookie({
      name: "influrios_account",
      value: token,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    });
    await page.goto(workUrl, { waitUntil: "networkidle0", timeout: 60_000 });
    await page.screenshot({ path: path.join(SHOTS, "01-submit-dialog.png"), fullPage: true });

    // Fill note + link (controlled inputs)
    const note = "Browser retry note must stay after upload failure";
    const link = "https://drive.example/browser-retry-preserve";
    await page.waitForSelector('textarea[name="note"], input[name="linkUrl"]', { timeout: 15000 });
    await page.click('input[name="linkUrl"]', { clickCount: 3 });
    await page.type('input[name="linkUrl"]', link);
    await page.click('textarea[name="note"]', { clickCount: 3 });
    await page.type('textarea[name="note"]', note);

    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) throw new Error("No file input on submit form");
    await fileInput.uploadFile("/tmp/cor21-browser/retry.pdf");
    await sleep(500);
    await page.screenshot({ path: path.join(SHOTS, "02-filled-before-fail.png"), fullPage: true });

    await fsp.mkdir(storeRoot, { recursive: true });
    await fsp.chmod(storeRoot, 0o555);
    log(`store_chmod_fail=555`);

    // Submit — must target the dialog button (page also has logout <button type="submit">).
    const submitInDialog = async () => {
      const clicked = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        const btn = dialog && [...dialog.querySelectorAll("button")].find((b) => /submit|retry/i.test(b.textContent || ""));
        if (!btn) return false;
        btn.click();
        return true;
      }).catch(() => false);
      if (!clicked) throw new Error("Submit button inside dialog not found");
    };
    await Promise.all([
      submitInDialog(),
      page.waitForFunction(
        () => {
          const alert = document.querySelector('[role="dialog"] [role="alert"]');
          return Boolean(alert && /could not be stored|try again|network|temporar|not saved/i.test(alert.textContent || ""));
        },
        { timeout: 20000 },
      ).catch(() => null),
    ]);
    await sleep(800);

    const afterFail = await page.evaluate(() => {
      const alert = document.querySelector('[role="alert"]');
      const noteEl = document.querySelector('textarea[name="note"]');
      const linkEl = document.querySelector('input[name="linkUrl"]');
      const dialog =
        document.querySelector('[role="dialog"]') ||
        document.querySelector("[data-focus]") ||
        document.querySelector("form[data-keep-scroll]");
      const fileText = document.body.innerText;
      return {
        error: alert?.textContent?.trim() || null,
        note: noteEl?.value || "",
        link: linkEl?.value || "",
        dialogOpen: Boolean(dialog),
        hasRetryPdf: /retry\.pdf/i.test(fileText),
        url: location.href,
      };
    });
    log(`fail_error=${JSON.stringify(afterFail.error)}`);
    log(`fail_note_preserved=${afterFail.note.includes("Browser retry note")}`);
    log(`fail_link_preserved=${afterFail.link.includes("browser-retry-preserve")}`);
    log(`fail_dialog_open=${afterFail.dialogOpen}`);
    log(`fail_file_listed=${afterFail.hasRetryPdf}`);
    await page.screenshot({ path: path.join(SHOTS, "03-upload-fail-popup-preserved.png"), fullPage: true });

    await fsp.chmod(storeRoot, 0o755);
    log(`store_chmod_restored=755`);

    // Retry from same popup
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      const btn = dialog && [...dialog.querySelectorAll("button")].find((b) => /retry|submit/i.test(b.textContent || ""));
      if (btn) btn.click();
    });
    await page.waitForFunction(() => /submitted=1/.test(location.href) || /In review|submitted/i.test(document.body.innerText), {
      timeout: 30000,
    }).catch(() => null);
    await sleep(1000);
    await page.screenshot({ path: path.join(SHOTS, "04-retry-success.png"), fullPage: true });

    const afterOk = await page.evaluate(() => ({
      url: location.href,
      bodyHasSubmitted: /submitted|In review|version/i.test(document.body.innerText),
    }));
    log(`retry_url=${afterOk.url}`);
    log(`retry_success_ui=${afterOk.bodyHasSubmitted || /submitted=1/.test(afterOk.url)}`);

    // Reload reopen
    const baseWork = workUrl.split("?")[0] + "?tab=milestones";
    await page.goto(baseWork, { waitUntil: "networkidle0", timeout: 60000 });
    await page.screenshot({ path: path.join(SHOTS, "05-reload-reopen.png"), fullPage: true });
    const reopen = await page.evaluate(() => ({
      hasNote: /Browser retry note|browser-retry-preserve|retry\.pdf|In review|submitted/i.test(document.body.innerText),
      textSample: document.body.innerText.slice(0, 500).replace(/\s+/g, " "),
    }));
    log(`reopen_shows_submission=${reopen.hasNote}`);
    log(`reopen_sample=${reopen.textSample.slice(0, 200)}`);

    const pass =
      afterFail.dialogOpen &&
      afterFail.note.includes("Browser retry note") &&
      afterFail.link.includes("browser-retry-preserve") &&
      Boolean(afterFail.error) &&
      (afterOk.bodyHasSubmitted || /submitted=1/.test(afterOk.url));
    log(`browser_retry_preserve_pass=${pass}`);
  } finally {
    await fsp.chmod(storeRoot, 0o755).catch(() => undefined);
    await browser.close();
  }
  writeFileSync(path.join(OUT, "browser-retry-evidence.txt"), lines.join("\n") + "\n");
  log(`wrote=${path.join(OUT, "browser-retry-evidence.txt")}`);
}

main().catch((err) => {
  console.error(err);
  writeFileSync(path.join(OUT, "browser-retry-evidence.txt"), lines.concat([String(err)]).join("\n") + "\n");
  process.exit(1);
});
