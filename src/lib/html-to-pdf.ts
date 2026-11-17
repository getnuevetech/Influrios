/**
 * Print self-contained HTML to PDF with the system Chrome/Chromium binary.
 * Keeps downloaded contracts visually identical to the Document tab HTML.
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/local/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
  "/usr/lib/chromium/chromium",
  "google-chrome-stable",
  "google-chrome",
  "chromium-browser",
  "chromium",
].filter((value): value is string => Boolean(value));

function resolveChromePath(): string | null {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      if (candidate.includes("/") || candidate.startsWith(".")) {
        accessSync(candidate, constants.X_OK);
        return candidate;
      }
    } catch {
      // try next absolute path
    }
  }
  // Bare command names only when resolvable on PATH.
  for (const candidate of CHROME_CANDIDATES) {
    if (candidate.includes("/") || candidate.startsWith(".")) continue;
    try {
      // `which` via access on common bin dirs is already covered; accept PATH names last.
      accessSync(`/usr/bin/${candidate}`, constants.X_OK);
      return `/usr/bin/${candidate}`;
    } catch {
      try {
        accessSync(`/usr/local/bin/${candidate}`, constants.X_OK);
        return `/usr/local/bin/${candidate}`;
      } catch {
        // try next
      }
    }
  }
  return null;
}

function run(bin: string, args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Chrome print-to-pdf failed (${code}): ${stderr.slice(0, 800)}`));
    });
  });
}

/** Convert a complete HTML document into PDF bytes via headless Chrome. */
export async function htmlDocumentToPdf(html: string): Promise<Buffer> {
  const chrome = resolveChromePath();
  if (!chrome) {
    throw new Error(
      "Chrome/Chromium is required to print the formal agreement PDF. Install chromium or set CHROME_PATH.",
    );
  }
  const dir = await mkdtemp(join(tmpdir(), "influrios-agree-"));
  const htmlPath = join(dir, "agreement.html");
  const pdfPath = join(dir, "agreement.pdf");
  try {
    await writeFile(htmlPath, html, "utf8");
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--allow-file-access-from-files",
      "--no-pdf-header-footer",
      `--print-to-pdf=${pdfPath}`,
      `file://${htmlPath}`,
    ];
    await run(chrome, args, {
      ...process.env,
      HOME: process.env.HOME || tmpdir(),
    });
    return await readFile(pdfPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export function chromeAvailableForPdf(): boolean {
  return Boolean(resolveChromePath());
}
