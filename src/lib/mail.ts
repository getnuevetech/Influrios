import dns from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";
import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/provider-secrets";

export type MailConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  from: string;
};

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
};

export type MailSettingsRow = {
  host: string;
  port: number;
  username: string;
  fromAddress: string;
  secretCipher: string | null;
  enabled: boolean;
};

export type MailConfigResolution =
  | { ok: true; config: MailConfig; source: "admin" | "env" }
  | { ok: false; error: string; source: "none" };

export function mailConfigFromEnv(env: {
  SMTP_HOST?: string;
  SMTP_FROM?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
} = {
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_FROM: process.env.SMTP_FROM,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
}): MailConfig | null {
  const host = env.SMTP_HOST?.trim() ?? "";
  const from = env.SMTP_FROM?.trim() ?? "";
  if (!host || !from) return null;
  const port = Number(env.SMTP_PORT || 587);
  return {
    host,
    port: Number.isFinite(port) && port > 0 && port <= 65535 ? port : 587,
    username: env.SMTP_USER?.trim() ?? "",
    password: env.SMTP_PASSWORD ?? "",
    from,
  };
}

/**
 * Resolve admin SMTP into a sendable config, or a specific reason it cannot send.
 * Username without a decryptable password is rejected. Password-less SMTP is allowed when username is blank.
 */
export function resolveMailConfigFromRow(
  row: MailSettingsRow | null | undefined,
  decrypt: (cipher: string) => string | null = decryptSecret,
): MailConfigResolution {
  if (!row) {
    return { ok: false, error: "No SMTP settings are saved yet. Fill the form, check Enabled, and save.", source: "none" };
  }
  if (!row.enabled) {
    return {
      ok: false,
      error: "SMTP settings are saved but Enabled is off. Check Enabled and save, then send the test again.",
      source: "none",
    };
  }
  const host = normalizeSmtpHost(row.host);
  const from = row.fromAddress.trim();
  const username = row.username.trim();
  if (!host || !from) {
    return {
      ok: false,
      error: "Host and from address are required while SMTP is enabled. Nothing was sent.",
      source: "none",
    };
  }
  let password = "";
  if (row.secretCipher) {
    const plain = decrypt(row.secretCipher);
    if (!plain) {
      return {
        ok: false,
        error:
          "The saved SMTP password cannot be decrypted. Re-enter the password and save (AUTH_SECRET may have changed).",
        source: "none",
      };
    }
    password = plain;
  } else if (username) {
    return {
      ok: false,
      error: "SMTP username is set but no password is saved. Enter the password, check Enabled, and save.",
      source: "none",
    };
  }
  return {
    ok: true,
    source: "admin",
    config: {
      host,
      port: row.port,
      username,
      password,
      from,
    },
  };
}

export function resolveMailConfig(
  row: MailSettingsRow | null | undefined,
  envConfig: MailConfig | null = mailConfigFromEnv(),
  decrypt: (cipher: string) => string | null = decryptSecret,
): MailConfigResolution {
  const fromRow = resolveMailConfigFromRow(row, decrypt);
  if (fromRow.ok) return fromRow;
  if (envConfig) return { ok: true, config: envConfig, source: "env" };
  return fromRow;
}

/**
 * Admin UI readiness without decrypting the password.
 * Decrypt stays on the send path so a page render cannot block the event loop.
 */
export function mailSettingsAppearance(
  row: MailSettingsRow | null | undefined,
  envConfigured = Boolean(mailConfigFromEnv()),
): { ready: boolean; readySource: "admin" | "env" | "none"; readyError: string } {
  if (!row) {
    if (envConfigured) return { ready: true, readySource: "env", readyError: "" };
    return {
      ready: false,
      readySource: "none",
      readyError: "No SMTP settings are saved yet. Fill the form, check Enabled, and save.",
    };
  }
  if (!row.enabled) {
    if (envConfigured) return { ready: true, readySource: "env", readyError: "" };
    return {
      ready: false,
      readySource: "none",
      readyError: "SMTP settings are saved but Enabled is off. Check Enabled and save, then send the test again.",
    };
  }
  const host = row.host.trim();
  const from = row.fromAddress.trim();
  const username = row.username.trim();
  if (!host || !from) {
    if (envConfigured) return { ready: true, readySource: "env", readyError: "" };
    return {
      ready: false,
      readySource: "none",
      readyError: "Host and from address are required while SMTP is enabled. Nothing was sent.",
    };
  }
  if (username && !row.secretCipher) {
    if (envConfigured) return { ready: true, readySource: "env", readyError: "" };
    return {
      ready: false,
      readySource: "none",
      readyError: "SMTP username is set but no password is saved. Enter the password, check Enabled, and save.",
    };
  }
  return { ready: true, readySource: "admin", readyError: "" };
}

/** Admin row when it is enabled and complete, otherwise the environment. */
export async function loadMailConfig(): Promise<MailConfig | null> {
  const resolved = await resolveMailConfigStatus();
  return resolved.ok ? resolved.config : null;
}

export async function resolveMailConfigStatus(): Promise<MailConfigResolution> {
  let row: MailSettingsRow | null = null;
  try {
    row = await prisma.mailSettings.findUnique({ where: { id: "default" } });
  } catch {
    /* table missing or unread — fall through to env */
  }
  return resolveMailConfig(row, mailConfigFromEnv());
}

export async function mailReady(): Promise<boolean> {
  return Boolean(await loadMailConfig());
}

export async function mailSettingsView() {
  const row = await prisma.mailSettings.findUnique({ where: { id: "default" } });
  const env = mailConfigFromEnv();
  const appearance = mailSettingsAppearance(row, Boolean(env));
  return {
    host: row?.host ?? "",
    port: row?.port ?? 587,
    username: row?.username ?? "",
    fromAddress: row?.fromAddress ?? "",
    enabled: row?.enabled ?? false,
    hasSecret: Boolean(row?.secretCipher),
    envConfigured: Boolean(env),
    envHost: env?.host ?? "",
    ready: appearance.ready,
    readySource: appearance.readySource,
    readyError: appearance.readyError,
  };
}

export async function saveMailSettings(input: {
  host: string;
  port: number;
  username: string;
  fromAddress: string;
  password: string;
  enabled: boolean;
  clearSecret: boolean;
}) {
  const host = normalizeSmtpHost(input.host).slice(0, 200);
  const fromAddress = input.fromAddress.trim().slice(0, 200);
  const username = input.username.trim().slice(0, 200);
  const port = Number.isFinite(input.port) ? Math.min(65535, Math.max(1, Math.floor(input.port))) : 587;
  const existing = await prisma.mailSettings.findUnique({ where: { id: "default" } });
  let secretCipher = existing?.secretCipher ?? null;
  if (input.clearSecret) secretCipher = null;
  if (input.password.trim()) secretCipher = encryptSecret(input.password.trim());
  if (input.enabled && (!host || !fromAddress)) {
    throw new Error("Host and from address are required before SMTP can be enabled.");
  }
  if (input.enabled && username && !secretCipher) {
    throw new Error("Enter the SMTP password before enabling when a username is set.");
  }
  await prisma.mailSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      host,
      port,
      username,
      fromAddress,
      secretCipher,
      enabled: input.enabled,
    },
    update: {
      host,
      port,
      username,
      fromAddress,
      secretCipher,
      enabled: input.enabled,
    },
  });
}

function headerSafe(value: string) {
  return value.replace(/[\r\n]/g, " ").trim().slice(0, 300);
}

class SmtpReader {
  private buf = "";
  private waiters: { resolve: (line: string) => void; reject: (error: Error) => void }[] = [];
  private failed: Error | null = null;

  constructor(private socket: net.Socket) {
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      this.buf += chunk;
      this.drain();
    });
    socket.on("error", (error) => this.fail(error instanceof Error ? error : new Error("SMTP connection failed")));
    socket.on("close", () => this.fail(new Error("SMTP connection closed")));
  }

  private fail(error: Error) {
    if (this.failed) return;
    this.failed = error;
    const pending = this.waiters.splice(0);
    for (const waiter of pending) waiter.reject(error);
  }

  private drain() {
    while (this.waiters.length) {
      const idx = this.buf.indexOf("\n");
      if (idx < 0) return;
      const line = this.buf.slice(0, idx).replace(/\r$/, "");
      this.buf = this.buf.slice(idx + 1);
      this.waiters.shift()!.resolve(line);
    }
  }

  private line(): Promise<string> {
    if (this.failed) return Promise.reject(this.failed);
    const idx = this.buf.indexOf("\n");
    if (idx >= 0) {
      const line = this.buf.slice(0, idx).replace(/\r$/, "");
      this.buf = this.buf.slice(idx + 1);
      return Promise.resolve(line);
    }
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
  }

  async reply(): Promise<{ code: number; text: string }> {
    const lines: string[] = [];
    for (;;) {
      const line = await this.line();
      lines.push(line);
      if (/^\d{3} /.test(line)) return { code: Number(line.slice(0, 3)), text: lines.join("\n") };
      if (lines.length > 40) return { code: 0, text: lines.join("\n") };
    }
  }

  detach() {
    this.socket.removeAllListeners("data");
    this.socket.removeAllListeners("error");
    this.socket.removeAllListeners("close");
  }
}

function expectCode(reply: { code: number; text: string }, codes: number[], step: string) {
  if (!codes.includes(reply.code)) {
    throw new Error(`SMTP ${step} returned ${reply.code}. ${reply.text}`.slice(0, 500));
  }
}

async function command(socket: net.Socket, reader: SmtpReader, line: string, codes: number[], step: string) {
  socket.write(`${line}\r\n`);
  const reply = await reader.reply();
  expectCode(reply, codes, step);
  return reply;
}

function dotStuff(text: string) {
  return text
    .replace(/\r?\n/g, "\r\n")
    .split("\r\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}

const SMTP_TIMEOUT_MS = 12_000;

/** Gmail/Google Workspace SMTP host. `smtp.google.com` resolves but does not accept mail. */
export function normalizeSmtpHost(host: string): string {
  const trimmed = host.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "smtp.google.com" || lower === "google.com") return "smtp.gmail.com";
  return trimmed;
}

function attachSmtpTimeout(socket: net.Socket, label: string) {
  socket.setTimeout(SMTP_TIMEOUT_MS);
  socket.on("timeout", () => {
    socket.destroy(new Error(`${label} timed out after ${SMTP_TIMEOUT_MS / 1000}s.`));
  });
}

/** Prefer IPv4 — many cloud hosts have broken IPv6 routes that hang SMTP connects. */
async function resolveSmtpAddress(host: string): Promise<{ host: string; servername: string }> {
  try {
    const v4 = await dns.lookup(host, { family: 4 });
    return { host: v4.address, servername: host };
  } catch {
    return { host, servername: host };
  }
}

async function openSocket(host: string, port: number): Promise<net.Socket> {
  const target = await resolveSmtpAddress(host);
  if (port === 465) {
    return await new Promise((resolve, reject) => {
      const socket = tls.connect({ host: target.host, port, servername: target.servername });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error(`SMTP TLS connection to ${host}:${port} timed out.`));
      }, SMTP_TIMEOUT_MS);
      socket.once("secureConnect", () => {
        clearTimeout(timer);
        resolve(socket);
      });
      socket.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }
  return await new Promise((resolve, reject) => {
    const socket = net.connect({ host: target.host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`SMTP connection to ${host}:${port} timed out.`));
    }, SMTP_TIMEOUT_MS);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function upgradeStartTls(socket: net.Socket, reader: SmtpReader, host: string) {
  await command(socket, reader, "STARTTLS", [220], "STARTTLS");
  reader.detach();
  const secure = tls.connect({ socket, servername: host });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      secure.destroy();
      reject(new Error(`SMTP STARTTLS to ${host} timed out.`));
    }, SMTP_TIMEOUT_MS);
    secure.once("secureConnect", () => {
      clearTimeout(timer);
      resolve();
    });
    secure.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
  return secure;
}

function supportsAuth(ehloText: string, mechanism: "PLAIN" | "LOGIN") {
  const authLine = ehloText
    .split(/\r?\n/)
    .map((line) => line.replace(/^\d{3}[\s-]/, ""))
    .find((line) => /^AUTH\b/i.test(line));
  if (!authLine) return false;
  return new RegExp(`\\b${mechanism}\\b`, "i").test(authLine);
}

async function authenticateSmtp(socket: net.Socket, reader: SmtpReader, config: MailConfig, ehloText: string) {
  if (!config.username) return;
  const preferPlain = supportsAuth(ehloText, "PLAIN") || !supportsAuth(ehloText, "LOGIN");
  if (preferPlain) {
    const payload = Buffer.from(`\0${config.username}\0${config.password}`, "utf8").toString("base64");
    await command(socket, reader, `AUTH PLAIN ${payload}`, [235], "AUTH PLAIN");
    return;
  }
  await command(socket, reader, "AUTH LOGIN", [334], "AUTH LOGIN");
  await command(socket, reader, Buffer.from(config.username, "utf8").toString("base64"), [334], "AUTH user");
  await command(socket, reader, Buffer.from(config.password, "utf8").toString("base64"), [235], "AUTH password");
}

export function formatSmtpDeliveryError(error: unknown, host: string, port: number): string {
  const raw = error instanceof Error ? error.message : "SMTP send failed";
  const lower = host.trim().toLowerCase();
  if (lower === "smtp.google.com" || lower === "google.com") {
    return "Use smtp.gmail.com (not smtp.google.com) on port 587 with your Google account and an App Password.";
  }
  if (/ENOTFOUND|getaddrinfo/i.test(raw)) {
    return `SMTP host “${host}” could not be found. Check the hostname and save again.`;
  }
  if (/ECONNREFUSED/i.test(raw)) {
    return `SMTP connection to ${host}:${port} was refused. Check the host and port.`;
  }
  if (/ETIMEDOUT|timed out/i.test(raw)) {
    return `SMTP connection to ${host}:${port} timed out. For Gmail use smtp.gmail.com:587. If this host is AWS Lightsail, outbound SMTP may be blocked — use a transactional provider or ask AWS to allow port ${port}.`;
  }
  if (/CERT_|SSL|TLS/i.test(raw)) {
    return `SMTP TLS to ${host}:${port} failed. ${raw}`.slice(0, 400);
  }
  return raw.slice(0, 400);
}

/** Speak SMTP. ok is true only after the server accepts the message with a 2xx code. */
export async function deliverMail(config: MailConfig, message: MailMessage): Promise<{ ok: true } | { ok: false; error: string }> {
  const to = headerSafe(message.to);
  const from = headerSafe(config.from);
  const subject = headerSafe(message.subject);
  if (!to.includes("@") || !from.includes("@")) {
    return { ok: false, error: "A from address and a recipient are required. Nothing was sent." };
  }
  let socket: net.Socket | null = null;
  try {
    socket = await openSocket(config.host, config.port);
    attachSmtpTimeout(socket, `SMTP session with ${config.host}`);
    let reader = new SmtpReader(socket);
    const greeting = await reader.reply();
    expectCode(greeting, [220], "greeting");
    let ehlo = await command(socket, reader, "EHLO influrios.local", [250], "EHLO");
    if (config.port !== 465 && /STARTTLS/i.test(ehlo.text)) {
      socket = await upgradeStartTls(socket, reader, config.host);
      attachSmtpTimeout(socket, `SMTP STARTTLS session with ${config.host}`);
      reader = new SmtpReader(socket);
      ehlo = await command(socket, reader, "EHLO influrios.local", [250], "EHLO");
    }
    await authenticateSmtp(socket, reader, config, ehlo.text);
    await command(socket, reader, `MAIL FROM:<${from}>`, [250], "MAIL FROM");
    await command(socket, reader, `RCPT TO:<${to}>`, [250, 251], "RCPT TO");
    await command(socket, reader, "DATA", [354], "DATA");
    const body = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "",
      dotStuff(message.text),
      "",
    ].join("\r\n");
    socket.write(`${body}\r\n.\r\n`);
    const accepted = await reader.reply();
    expectCode(accepted, [250], "message");
    socket.write("QUIT\r\n");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: formatSmtpDeliveryError(error, config.host, config.port) };
  } finally {
    socket?.destroy();
  }
}

export async function sendMail(message: MailMessage): Promise<{ ok: true } | { ok: false; error: string }> {
  const resolved = await resolveMailConfigStatus();
  if (!resolved.ok) return { ok: false, error: resolved.error };
  return deliverMail(resolved.config, message);
}

/** Labels for an admin test send. The address is the only real recipient fact. */
export function previewMailVars(to?: string): Record<string, string> {
  const origin = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
  return {
    name: "Preview recipient",
    email: (to || "").trim(),
    phone: "",
    link: origin,
    expiry: "preview window",
    profile: "preview profile",
    business: "Preview business",
    collaboration: "Preview collaboration",
    amount: "preview amount",
    code: "preview code",
  };
}

async function invitationTestCopy(to: string) {
  const { DEFAULT_INVITATION_TEMPLATE, renderInvitationCopy } = await import("@/lib/invitations");
  let subject = DEFAULT_INVITATION_TEMPLATE.subject;
  let body = DEFAULT_INVITATION_TEMPLATE.body;
  try {
    const template = await prisma.invitationTemplate.findUnique({ where: { key: DEFAULT_INVITATION_TEMPLATE.key } });
    if (template) {
      subject = template.subject;
      body = template.body;
    }
  } catch {
    /* use the built-in template */
  }
  const preview = previewMailVars(to);
  return {
    subject: renderInvitationCopy(subject, preview),
    text: renderInvitationCopy(body, preview),
  };
}

/** Send the claim invitation template. No job is recorded when SMTP is not configured. */
export async function sendInvitationTest(to: string, record = true): Promise<{ ok: boolean; message: string }> {
  const resolved = await resolveMailConfigStatus();
  if (!resolved.ok) return { ok: false, message: resolved.error };
  const copy = await invitationTestCopy(to);
  const result = await deliverMail(resolved.config, { to, ...copy });
  if (record) {
    try {
      await prisma.job.create({
        data: {
          kind: "mail_test",
          status: result.ok ? "succeeded" : "failed",
          lastError: result.ok ? null : result.error,
          payload: { to: headerSafe(to) },
        },
      });
    } catch {
      /* the SMTP result still stands */
    }
  }
  if (result.ok) return { ok: true, message: "SMTP accepted the claim invitation template." };
  return { ok: false, message: result.error };
}

/**
 * Create a running mail_test job for the admin UI, then run SMTP outside the
 * request via the provided scheduler (Next.js `after`) so the page can redirect
 * without waiting on the SMTP round-trip.
 */
export async function beginMailInvitationTest(
  to: string,
  schedule: (work: () => Promise<void>) => void,
): Promise<{ ok: true; jobId: string } | { ok: false; message: string }> {
  const resolved = await resolveMailConfigStatus();
  if (!resolved.ok) return { ok: false, message: resolved.error };
  const safeTo = headerSafe(to);
  let jobId = "";
  try {
    const job = await prisma.job.create({
      data: {
        kind: "mail_test",
        status: "running",
        attempts: 1,
        payload: { to: safeTo },
      },
    });
    jobId = job.id;
  } catch {
    return { ok: false, message: "Could not record the mail test job. Nothing was sent." };
  }
  const config = resolved.config;
  schedule(async () => {
    try {
      const copy = await invitationTestCopy(safeTo);
      const result = await deliverMail(config, { to: safeTo, ...copy });
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: result.ok ? "succeeded" : "failed",
          lastError: result.ok ? null : result.error.slice(0, 500),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "SMTP send failed";
      await prisma.job
        .update({
          where: { id: jobId },
          data: { status: "failed", lastError: message.slice(0, 500) },
        })
        .catch(() => undefined);
    }
  });
  return { ok: true, jobId };
}

export async function listRecentMailTests(limit = 5) {
  try {
    const rows = await prisma.job.findMany({
      where: { kind: "mail_test" },
      orderBy: { createdAt: "desc" },
      take: Math.min(20, Math.max(1, limit)),
      select: {
        id: true,
        status: true,
        lastError: true,
        payload: true,
        createdAt: true,
      },
    });
    return rows.map((row) => {
      const payload = row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {};
      const to = typeof payload.to === "string" ? payload.to : "";
      return {
        id: row.id,
        status: row.status,
        to,
        lastError: row.lastError ?? "",
        createdAt: row.createdAt.toISOString(),
      };
    });
  } catch {
    return [];
  }
}
