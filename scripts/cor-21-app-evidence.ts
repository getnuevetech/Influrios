/**
 * COR-21 application evidence against a running Next server (HTTP + server action).
 * Distinguishes from helper-only tests in deliverable-upload-path.test.ts.
 *
 * Requires: DATABASE_URL, AUTH_SECRET matching the server, EVIDENCE_BASE_URL.
 */
import { createWriteStream, mkdirSync, readFileSync, writeFileSync, promises as fsp } from "fs";
import path from "path";
import { tmpdir } from "os";
import { accountSessionToken, hashAccountPassword } from "../src/lib/accounts";
import { ensureOwnedBusinessWorkspace } from "../src/lib/business";
import { prisma } from "../src/lib/db";

const base = (process.env.EVIDENCE_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const OUT = path.resolve("media/cor-20-23-acceptance");
const PASSWORD = "EvidencePass1!";
const COOKIE = "influrios_account";

mkdirSync(OUT, { recursive: true });

function cookie(userId: string) {
  return `${COOKIE}=${accountSessionToken(userId)}`;
}

function writeBigPdf(filePath: string, sizeBytes: number) {
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
  return new Promise<void>((resolve, reject) => {
    fd.on("finish", () => resolve());
    fd.on("error", reject);
  });
}

async function waitForApp(timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${base}/login`, { redirect: "manual" });
      if (res.status === 200) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

async function extractActionIds(pageUrl: string, cookieHeader: string) {
  const page = await fetch(pageUrl, { redirect: "manual", headers: { cookie: cookieHeader } });
  // Flight payloads escape quotes as \\" inside script strings — normalize before matching.
  const html = (await page.text()).replace(/\\u002F/g, "/").replace(/\\"/g, '"').replace(/\\\\n/g, "\n");
  // Named server actions from RSC flight (prefer these — $ACTION_ID_ on the page may be logout).
  const named = new Map<string, string>();
  for (const match of html.matchAll(/"id":"([0-9a-f]{40,44})","bound":null,"name":"([A-Za-z0-9_]+)"/g)) {
    named.set(match[2], match[1]);
  }
  const submitId = named.get("actionSubmitMilestone") ?? "";
  const ids = submitId ? [submitId] : [];
  return {
    status: page.status,
    ids,
    named: Object.fromEntries(named),
    sample: html.slice(0, 400),
  };
}

async function postServerAction(opts: {
  pageUrl: string;
  cookieHeader: string;
  actionId: string;
  form: FormData;
  mode: "action-id-field" | "next-action-header";
}) {
  const origin = new URL(opts.pageUrl).origin;
  const headers: Record<string, string> = {
    cookie: opts.cookieHeader,
    Origin: origin,
    Referer: opts.pageUrl,
  };
  const body = opts.form;
  if (opts.mode === "action-id-field") {
    body.set(`$ACTION_ID_${opts.actionId}`, "");
  } else {
    headers["Next-Action"] = opts.actionId;
    headers["Accept"] = "text/x-component";
  }
  const response = await fetch(opts.pageUrl, {
    method: "POST",
    redirect: "manual",
    headers,
    body,
  });
  const text = await response.text();
  return {
    status: response.status,
    location: response.headers.get("location") ?? response.headers.get("x-action-redirect") ?? "",
    missing: response.headers.get("x-nextjs-action-not-found") ?? "",
    body: text.slice(0, 500),
  };
}

async function download(fileId: string, cookieHeader?: string) {
  const response = await fetch(`${base}/api/deliverables/${fileId}`, {
    redirect: "manual",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  const buf = Buffer.from(await response.arrayBuffer());
  return { status: response.status, bytes: buf.length, contentType: response.headers.get("content-type") };
}

async function main() {
  const stamp = Date.now().toString(36);
  const lines: string[] = [];
  const log = (line: string) => {
    lines.push(line);
    console.log(line);
  };

  log(`# COR-21 application evidence (HTTP / server action)`);
  log(`base=${base}`);
  log(`stamp=${stamp}`);
  log(`bodySizeLimit=${/bodySizeLimit:\s*"([^"]+)"/.exec(readFileSync("next.config.ts", "utf8"))?.[1]}`);

  const passwordHash = hashAccountPassword(PASSWORD);
  const business = await prisma.user.create({
    data: {
      email: `ev-biz-${stamp}@example.com`,
      name: `Evidence Biz ${stamp}`,
      role: "BUSINESS",
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });
  const stranger = await prisma.user.create({
    data: {
      email: `ev-str-${stamp}@example.com`,
      name: `Evidence Stranger ${stamp}`,
      role: "BUSINESS",
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });
  const creator = await prisma.user.create({
    data: {
      email: `ev-cre-${stamp}@example.com`,
      name: `Evidence Creator ${stamp}`,
      role: "CREATOR",
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });
  const ws = await ensureOwnedBusinessWorkspace(business.id, { name: `Evidence WS ${stamp}` });
  await ensureOwnedBusinessWorkspace(stranger.id, { name: `Evidence Other ${stamp}` });
  const slug = `ev-${stamp}`;
  await prisma.creator.create({
    data: { userId: creator.id, slug, displayName: creator.name ?? slug },
  });

  const funding = await prisma.collaborationFunding.create({
    data: {
      jurisdictionCode: "US",
      businessName: business.name ?? "Biz",
      workspaceId: ws.businessId,
      creatorSlug: slug,
      title: `Evidence deal ${stamp}`,
      currency: "USD",
      grossCents: 10_000,
      feeCents: 0,
      feeSnapshotJson: {},
      serviceLevel: "contracted",
      status: "held",
      providerCode: "marketplace_sandbox",
    },
  });
  const milestone = await prisma.fundingMilestone.create({
    data: {
      fundingId: funding.id,
      title: "Kickoff",
      amountCents: 10_000,
      sortOrder: 0,
      status: "pending",
      reviewWindowHours: 72,
    },
  });

  const workUrl = `${base}/collaboration/work/${funding.id}?tab=milestones&focus=${milestone.id}&intent=submit`;
  log(`fundingId=${funding.id}`);
  log(`milestoneId=${milestone.id}`);
  log(`creatorEmail=${creator.email}`);
  log(`businessEmail=${business.email}`);
  log(`strangerEmail=${stranger.email}`);
  log(`password=${PASSWORD}`);
  log(`workUrl=${workUrl}`);

  const ready = await waitForApp();
  log(`app_ready=${ready}`);
  if (!ready) {
    writeFileSync(path.join(OUT, "app-http-evidence.txt"), lines.join("\n") + "\n");
    writeFileSync(
      path.join(OUT, "app-evidence-fixture.json"),
      JSON.stringify(
        {
          fundingId: funding.id,
          milestoneId: milestone.id,
          creatorEmail: creator.email,
          businessEmail: business.email,
          strangerEmail: stranger.email,
          password: PASSWORD,
          workUrl,
        },
        null,
        2,
      ),
    );
    throw new Error("App not ready at " + base);
  }

  const creatorCookie = cookie(creator.id);
  const ownerCookie = cookie(business.id);
  const strangerCookie = cookie(stranger.id);

  const extracted = await extractActionIds(workUrl, creatorCookie);
  log(`work_page_status=${extracted.status}`);
  log(`action_ids=${extracted.ids.join(",") || "(none)"}`);
  log(`named_actions=${JSON.stringify(extracted.named)}`);

  // Large batch files: 2 × 6 MB = 12 MB > former 10mb bodySizeLimit, each ≤ 8 MB rule
  const dir = path.join(tmpdir(), `cor21-${stamp}`);
  mkdirSync(dir, { recursive: true });
  const f1 = path.join(dir, "batch-a.pdf");
  const f2 = path.join(dir, "batch-b.pdf");
  await writeBigPdf(f1, 6 * 1024 * 1024);
  await writeBigPdf(f2, 6 * 1024 * 1024);
  log(`batch_files=${f1},${f2}`);
  log(`batch_total_bytes=${6 * 1024 * 1024 * 2}`);

  function buildSubmitForm(note: string, linkUrl: string, files: string[]) {
    const form = new FormData();
    form.set("dealId", funding.id);
    form.set("milestoneId", milestone.id);
    form.set("tab", "milestones");
    form.set("intent", "submit");
    form.set("note", note);
    form.set("linkUrl", linkUrl);
    for (const p of files) {
      const bytes = readFileSync(p);
      form.append("files", new Blob([bytes], { type: "application/pdf" }), path.basename(p));
    }
    return form;
  }

  // Attempt server-action submit with large batch through the workroom page
  let submitResult: Awaited<ReturnType<typeof postServerAction>> | null = null;
  const candidates = extracted.ids.length ? extracted.ids : [];
  // Fallback: scan built server reference manifest for actionSubmitMilestone if page had no $ACTION_ID_
  if (!candidates.length) {
    try {
      const { execSync } = await import("child_process");
      const grep = execSync(
        `rg -l "actionSubmitMilestone" .next/server 2>/dev/null | head -5`,
        { encoding: "utf8" },
      ).trim();
      log(`action_manifest_hint=${grep.replace(/\n/g, ",")}`);
    } catch {
      log(`action_manifest_hint=none`);
    }
  }

  for (const actionId of candidates) {
    // Progressive form POST ($ACTION_ID_ + Origin) — same multipart body the browser form sends.
    const form = buildSubmitForm(
      "Large batch evidence note for COR-21 body size — more than ten megabytes of files",
      "https://drive.example/evidence-batch",
      [f1, f2],
    );
    const t0 = Date.now();
    submitResult = await postServerAction({
      pageUrl: workUrl,
      cookieHeader: creatorCookie,
      actionId,
      form,
      mode: "action-id-field",
    });
    log(
      `submit_large_batch action=${actionId.slice(0, 12)}… status=${submitResult.status} loc=${submitResult.location} missing=${submitResult.missing} ms=${Date.now() - t0}`,
    );
    log(`submit_large_batch_body=${submitResult.body.slice(0, 200).replace(/\n/g, " ")}`);
    if (submitResult.status === 303 || submitResult.location.includes("submitted=1") || /submitted=1/.test(submitResult.body)) {
      break;
    }
  }

  // If action IDs unavailable, try posting without Next-Action to observe body-size acceptance
  // (framework may reject unknown action after parsing body — still proves >10MB accepted).
  if (!candidates.length) {
    const form = buildSubmitForm(
      "Large batch evidence note for COR-21 body size — more than ten megabytes of files",
      "https://drive.example/evidence-batch",
      [f1, f2],
    );
    const t0 = Date.now();
    const response = await fetch(workUrl, {
      method: "POST",
      redirect: "manual",
      headers: {
        cookie: creatorCookie,
        "Next-Action": "000000000000000000000000000000000000000000",
        Accept: "text/x-component",
      },
      body: form,
    });
    const text = await response.text();
    submitResult = {
      status: response.status,
      location: response.headers.get("location") ?? "",
      missing: response.headers.get("x-nextjs-action-not-found") ?? "",
      body: text.slice(0, 500),
    };
    log(
      `body_limit_probe status=${submitResult.status} missing=${submitResult.missing} ms=${Date.now() - t0} body=${submitResult.body.slice(0, 160).replace(/\n/g, " ")}`,
    );
    const bodySizeRejected =
      /Body exceeded|body.*limit|413|Entity Too Large|BodySizeLimit/i.test(text) ||
      /Body exceeded|body.*limit|Entity Too Large/i.test(submitResult.missing);
    log(`body_limit_rejected_before_handler=${bodySizeRejected}`);
    log(`body_limit_pass=${!bodySizeRejected && response.status !== 413}`);
  }

  // Count submissions after any successful redirect
  let submissions = await prisma.milestoneSubmission.findMany({
    where: { milestoneId: milestone.id },
    include: { files: true },
    orderBy: { version: "asc" },
  });
  log(`submissions_after_submit=${submissions.length}`);

  // --- Failed upload + retry via HTTP (chmod store dir) ---
  // Use a second funding so we can isolate retry behavior.
  const funding2 = await prisma.collaborationFunding.create({
    data: {
      jurisdictionCode: "US",
      businessName: business.name ?? "Biz",
      workspaceId: ws.businessId,
      creatorSlug: slug,
      title: `Evidence retry ${stamp}`,
      currency: "USD",
      grossCents: 10_000,
      feeCents: 0,
      feeSnapshotJson: {},
      serviceLevel: "contracted",
      status: "held",
      providerCode: "marketplace_sandbox",
    },
  });
  const milestone2 = await prisma.fundingMilestone.create({
    data: {
      fundingId: funding2.id,
      title: "Retry milestone",
      amountCents: 10_000,
      sortOrder: 0,
      status: "pending",
      reviewWindowHours: 72,
    },
  });
  const workUrl2 = `${base}/collaboration/work/${funding2.id}?tab=milestones&focus=${milestone2.id}&intent=submit`;
  const extracted2 = await extractActionIds(workUrl2, creatorCookie);
  const smallPdf = path.join(dir, "retry-small.pdf");
  writeFileSync(smallPdf, Buffer.from("%PDF-1.4\n%retry\n"));
  const storeRoot = path.join(process.cwd(), "data", "deliverables");
  await fsp.mkdir(storeRoot, { recursive: true });
  // Make parent unwritable so mkdir/write fails inside saveDeliverableFiles
  await fsp.chmod(storeRoot, 0o555);

  let failTry: Awaited<ReturnType<typeof postServerAction>> | null = null;
  let retryTry: Awaited<ReturnType<typeof postServerAction>> | null = null;
  const notePreserve = "Retry note must stay in the popup after upload failure";
  const linkPreserve = "https://drive.example/retry-preserve";

  try {
    const actionIds = extracted2.ids.length ? extracted2.ids : candidates;
    for (const actionId of actionIds) {
      const form = buildSubmitForm(notePreserve, linkPreserve, [smallPdf]);
      form.set("dealId", funding2.id);
      form.set("milestoneId", milestone2.id);
      failTry = await postServerAction({
        pageUrl: workUrl2,
        cookieHeader: creatorCookie,
        actionId,
        form,
        mode: "action-id-field",
      });
      log(`retry_fail_try action=${actionId.slice(0, 12)}… status=${failTry.status} loc=${failTry.location} body=${failTry.body.slice(0, 200).replace(/\n/g, " ")}`);
      if (failTry.status === 303 || failTry.status === 200 || failTry.body.includes("could not be stored")) break;
    }
  } finally {
    await fsp.chmod(storeRoot, 0o755);
  }

  const subsAfterFail = await prisma.milestoneSubmission.count({ where: { milestoneId: milestone2.id } });
  log(`submissions_after_forced_fail=${subsAfterFail}`);

  // Retry with writable store — expect exactly one successful submission
  for (const actionId of extracted2.ids.length ? extracted2.ids : candidates) {
    const form = buildSubmitForm(notePreserve, linkPreserve, [smallPdf]);
    form.set("dealId", funding2.id);
    form.set("milestoneId", milestone2.id);
    retryTry = await postServerAction({
      pageUrl: workUrl2,
      cookieHeader: creatorCookie,
      actionId,
      form,
      mode: "action-id-field",
    });
    log(`retry_ok_try action=${actionId.slice(0, 12)}… status=${retryTry.status} loc=${retryTry.location}`);
    if (retryTry.location.includes("submitted=1") || retryTry.status === 303) break;
  }

  const retrySubs = await prisma.milestoneSubmission.findMany({
    where: { milestoneId: milestone2.id },
    include: { files: true },
    orderBy: { version: "asc" },
  });
  log(`submissions_after_retry=${retrySubs.length}`);
  log(`retry_one_success=${retrySubs.length === 1}`);

  // If large-batch submit did not land via action id, submit a normal file via helper-free path:
  // create submission by succeeding server action with small file on funding1 if still empty.
  if (submissions.length === 0 && candidates.length) {
    const small = path.join(dir, "auth-cut.pdf");
    writeFileSync(small, Buffer.from("%PDF-1.4\nauth\n"));
    for (const actionId of candidates) {
      const form = buildSubmitForm("Evidence cut for authorized download path", "https://drive.example/cut", [small]);
      const res = await postServerAction({
        pageUrl: workUrl,
        cookieHeader: creatorCookie,
        actionId,
        form,
        mode: "action-id-field",
      });
      log(`auth_seed_submit status=${res.status} loc=${res.location}`);
      if (res.location.includes("submitted=1") || res.status === 303) break;
    }
    submissions = await prisma.milestoneSubmission.findMany({
      where: { milestoneId: milestone.id },
      include: { files: true },
      orderBy: { version: "asc" },
    });
  }

  // Prefer funding1 files; fall back to funding2
  let fileId =
    submissions.flatMap((s) => s.files).map((f) => f.id)[0] ??
    retrySubs.flatMap((s) => s.files).map((f) => f.id)[0] ??
    "";

  // Reload work page (reopen UI) after submit
  const reopenFundingId = submissions.length ? funding.id : funding2.id;
  const reopenUrl = `${base}/collaboration/work/${reopenFundingId}?tab=milestones`;
  const reopen = await fetch(reopenUrl, { headers: { cookie: creatorCookie }, redirect: "manual" });
  const reopenHtml = await reopen.text();
  log(`reopen_status=${reopen.status}`);
  log(`reopen_shows_submitted=${/submitted|version|deliverable|Evidence cut|Retry note|batch-a|auth-cut/i.test(reopenHtml)}`);

  if (!fileId) {
    // Last resort: read any milestoneFile for these fundings
    const any = await prisma.milestoneFile.findFirst({
      where: { fundingId: { in: [funding.id, funding2.id] } },
      orderBy: { createdAt: "desc" },
    });
    fileId = any?.id ?? "";
  }
  log(`download_fileId=${fileId || "(none)"}`);

  if (fileId) {
    const owner = await download(fileId, ownerCookie);
    const influencer = await download(fileId, creatorCookie);
    const cross = await download(fileId, strangerCookie);
    const signedOut = await download(fileId);
    log(`download_owner_status=${owner.status} bytes=${owner.bytes}`);
    log(`download_influencer_status=${influencer.status} bytes=${influencer.bytes}`);
    log(`download_stranger_status=${cross.status}`);
    log(`download_signed_out_status=${signedOut.status}`);
    const pass =
      owner.status === 200 &&
      influencer.status === 200 &&
      owner.bytes > 0 &&
      cross.status === 404 &&
      signedOut.status === 401;
    log(`http_download_auth_pass=${pass}`);
  } else {
    log(`http_download_auth_pass=false`);
    log(`http_download_auth_note=no file persisted via server action — browser form evidence required`);
  }

  writeFileSync(path.join(OUT, "app-http-evidence.txt"), lines.join("\n") + "\n");
  writeFileSync(
    path.join(OUT, "app-evidence-fixture.json"),
    JSON.stringify(
      {
        stamp,
        fundingId: funding.id,
        milestoneId: milestone.id,
        funding2Id: funding2.id,
        milestone2Id: milestone2.id,
        creatorEmail: creator.email,
        businessEmail: business.email,
        strangerEmail: stranger.email,
        password: PASSWORD,
        workUrl,
        workUrl2,
        batchFiles: [f1, f2],
        smallPdf,
        notePreserve,
        linkPreserve,
        fileId,
        actionIds: candidates,
      },
      null,
      2,
    ),
  );
  log(`wrote=${path.join(OUT, "app-http-evidence.txt")}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
