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

/** Admin row when it is enabled and complete, otherwise the environment. */
export async function loadMailConfig(): Promise<MailConfig | null> {
  try {
    const row = await prisma.mailSettings.findUnique({ where: { id: "default" } });
    if (row?.enabled && row.host.trim() && row.fromAddress.trim() && row.secretCipher) {
      const password = decryptSecret(row.secretCipher);
      if (password) {
        return {
          host: row.host.trim(),
          port: row.port,
          username: row.username.trim(),
          password,
          from: row.fromAddress.trim(),
        };
      }
    }
  } catch {
    /* table missing or unread — fall through to env */
  }
  return mailConfigFromEnv();
}

export async function mailReady(): Promise<boolean> {
  return Boolean(await loadMailConfig());
}

export async function mailSettingsView() {
  const row = await prisma.mailSettings.findUnique({ where: { id: "default" } });
  const env = mailConfigFromEnv();
  return {
    host: row?.host ?? "",
    port: row?.port ?? 587,
    username: row?.username ?? "",
    fromAddress: row?.fromAddress ?? "",
    enabled: row?.enabled ?? false,
    hasSecret: Boolean(row?.secretCipher),
    envConfigured: Boolean(env),
    envHost: env?.host ?? "",
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
  const host = input.host.trim().slice(0, 200);
  const fromAddress = input.fromAddress.trim().slice(0, 200);
  const port = Number.isFinite(input.port) ? Math.min(65535, Math.max(1, Math.floor(input.port))) : 587;
  const existing = await prisma.mailSettings.findUnique({ where: { id: "default" } });
  let secretCipher = existing?.secretCipher ?? null;
  if (input.clearSecret) secretCipher = null;
  if (input.password.trim()) secretCipher = encryptSecret(input.password.trim());
  if (input.enabled && (!host || !fromAddress || !secretCipher)) {
    throw new Error("Host, from address, and a password are required before SMTP can be enabled.");
  }
  await prisma.mailSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      host,
      port,
      username: input.username.trim().slice(0, 200),
      fromAddress,
      secretCipher,
      enabled: input.enabled,
    },
    update: {
      host,
      port,
      username: input.username.trim().slice(0, 200),
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

async function openSocket(host: string, port: number): Promise<net.Socket> {
  if (port === 465) {
    return await new Promise((resolve, reject) => {
      const socket = tls.connect({ host, port, servername: host });
      socket.once("secureConnect", () => resolve(socket));
      socket.once("error", reject);
    });
  }
  return await new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    socket.once("connect", () => resolve(socket));
    socket.once("error", reject);
  });
}

async function upgradeStartTls(socket: net.Socket, reader: SmtpReader, host: string) {
  await command(socket, reader, "STARTTLS", [220], "STARTTLS");
  reader.detach();
  const secure = tls.connect({ socket, servername: host });
  await new Promise<void>((resolve, reject) => {
    secure.once("secureConnect", () => resolve());
    secure.once("error", reject);
  });
  return secure;
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
    socket.setTimeout(12_000);
    let reader = new SmtpReader(socket);
    const greeting = await reader.reply();
    expectCode(greeting, [220], "greeting");
    let ehlo = await command(socket, reader, "EHLO influrios.local", [250], "EHLO");
    if (config.port !== 465 && /STARTTLS/i.test(ehlo.text)) {
      socket = await upgradeStartTls(socket, reader, config.host);
      reader = new SmtpReader(socket);
      ehlo = await command(socket, reader, "EHLO influrios.local", [250], "EHLO");
    }
    if (config.username) {
      await command(socket, reader, "AUTH LOGIN", [334], "AUTH");
      await command(socket, reader, Buffer.from(config.username, "utf8").toString("base64"), [334], "AUTH user");
      await command(socket, reader, Buffer.from(config.password, "utf8").toString("base64"), [235], "AUTH password");
    }
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
    const messageText = error instanceof Error ? error.message : "SMTP send failed";
    return { ok: false, error: messageText.slice(0, 500) };
  } finally {
    socket?.destroy();
  }
}

export async function sendMail(message: MailMessage): Promise<{ ok: true } | { ok: false; error: string }> {
  const config = await loadMailConfig();
  if (!config) return { ok: false, error: "SMTP is not configured. Nothing was sent." };
  return deliverMail(config, message);
}

const SAMPLE_VARS = {
  name: "Sofia Martinez",
  link: "https://influrios.com/invite/sample",
  expiry: "14 days",
  profile: "sofia-martinez",
};

/** Send the claim invitation template. No job is recorded when SMTP is not configured. */
export async function sendInvitationTest(to: string, record = true): Promise<{ ok: boolean; message: string }> {
  const config = await loadMailConfig();
  if (!config) return { ok: false, message: "SMTP is not configured. Nothing was sent." };
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
  const result = await deliverMail(config, {
    to,
    subject: renderInvitationCopy(subject, SAMPLE_VARS),
    text: renderInvitationCopy(body, SAMPLE_VARS),
  });
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
