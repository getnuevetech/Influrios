import {
  EMAIL_GROUP_LABELS,
  type EmailCatalogTemplate,
  placeholdersIn,
} from "@/lib/email-catalog";

export type EmailCopy = {
  id: string;
  group: string;
  audience: string;
  category: string;
  subject: string;
  preheader: string;
  title: string;
  body: string[];
  cta: string;
  cta_url: string | null;
  facts: [string, string][];
};

const TOKEN = /\{\{(\w+)\}\}/g;

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function fillTemplate(value: string, context: Record<string, string>, skeleton = false) {
  return value.replace(TOKEN, (_match, key: string) => {
    if (skeleton) return `{{${key}}}`;
    if (!(key in context) || context[key] == null) {
      throw new Error(`Missing template variable: ${key}`);
    }
    return String(context[key]);
  });
}

export function assertHttpsAllowlisted(url: string, hosts: string[]) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Action links must be https URLs.");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error("Action links must be https URLs.");
  }
  if (parsed.port && parsed.port !== "443") throw new Error("Action links must be https URLs.");
  if (!hosts.includes(parsed.hostname)) throw new Error("Action link host is not allowed.");
}

function renderFacts(copy: EmailCopy, context: Record<string, string>, skeleton: boolean) {
  const rows: string[] = [];
  for (const [label, raw] of copy.facts) {
    const value = fillTemplate(raw, context, skeleton);
    if (!skeleton && !value.trim()) continue;
    if (label === "Verification code") {
      rows.push(
        `<p style="margin:18px 0 0;font-size:13px;font-weight:700;color:#3F3D56;">${escapeHtml(label)}</p>` +
          `<p style="margin:8px 0 0;padding:14px 16px;border-radius:12px;background:#F4F5FB;font-family:ui-monospace,monospace;font-size:28px;letter-spacing:4px;font-weight:700;color:#211E4E;">${escapeHtml(value)}</p>`,
      );
      continue;
    }
    rows.push(
      `<tr><td style="padding:10px 0;border-bottom:1px solid #E6E8F2;font-size:13px;color:#6E6A86;">${escapeHtml(label)}</td>` +
        `<td style="padding:10px 0;border-bottom:1px solid #E6E8F2;font-size:13px;font-weight:700;color:#211E4E;text-align:right;">${escapeHtml(value)}</td></tr>`,
    );
  }
  const table = rows.filter((row) => row.startsWith("<tr>"));
  const blocks = rows.filter((row) => !row.startsWith("<tr>"));
  const tableHtml = table.length
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;">${table.join("")}</table>`
    : "";
  return tableHtml + blocks.join("");
}

export function renderEmail(input: {
  copy: EmailCopy;
  context: Record<string, string>;
  hosts?: string[];
  skeleton?: boolean;
}) {
  const skeleton = input.skeleton ?? false;
  const hosts = input.hosts ?? ["influrios.example"];
  const context = input.context;
  const copy = input.copy;
  const subject = fillTemplate(copy.subject, context, skeleton);
  if (/[\r\n]/.test(subject)) throw new Error("The subject cannot contain a line break.");
  const preheader = fillTemplate(copy.preheader, context, skeleton);
  const title = fillTemplate(copy.title, context, skeleton);
  const paragraphs = copy.body.map((paragraph) => fillTemplate(paragraph, context, skeleton));
  const first = (context.first_name ?? "").trim();
  const greeting = first ? `Hi ${escapeHtml(first)},` : "Hello,";
  const group = EMAIL_GROUP_LABELS[copy.group] ?? copy.group;
  let action = "";
  if (copy.cta && copy.cta_url) {
    const url = fillTemplate(copy.cta_url, context, skeleton);
    if (!skeleton) assertHttpsAllowlisted(url, hosts);
    const label = escapeHtml(fillTemplate(copy.cta, context, skeleton));
    const safeUrl = escapeHtml(url);
    action =
      `<tr><td style="padding:8px 32px 0;"><a href="${safeUrl}" style="display:inline-block;background:#5836D6;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;line-height:44px;padding:0 22px;border-radius:999px;">${label}</a></td></tr>` +
      `<tr><td style="padding:12px 32px 0;font-size:12px;line-height:1.5;color:#6E6A86;">Button not working? Copy this address into your browser:<br>${safeUrl}</td></tr>`;
  }
  const facts = renderFacts(copy, context, skeleton);
  const body = paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#211E4E;">${escapeHtml(paragraph)}</p>`,
    )
    .join("");
  const internal = copy.category === "internal";
  const footerBits = [
    internal
      ? "This is an internal Influrios operations message."
      : "You are receiving this because of activity on your Influrios account.",
  ];
  if (copy.category === "outreach" || copy.category === "marketing") {
    footerBits.push(
      `Unsubscribe: ${escapeHtml(context.unsubscribe_url ?? "")}`,
      escapeHtml(context.sender_legal_name ?? ""),
      escapeHtml(context.sender_postal_address ?? ""),
    );
  } else if (!internal) {
    footerBits.push(`Email preferences: ${escapeHtml(context.preference_url ?? "")}`);
  }
  footerBits.push(`Support: ${escapeHtml(context.support_url ?? "")}`);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#F4F5FB;">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F4F5FB;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:18px;">
<tr><td style="padding:28px 32px 8px;font-family:Georgia,serif;font-size:22px;color:#211E4E;">∞ Influrios</td></tr>
<tr><td style="padding:0 32px 8px;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#5836D6;">${escapeHtml(group)}</td></tr>
<tr><td style="padding:8px 32px 0;font-family:Georgia,serif;font-size:28px;line-height:1.25;color:#211E4E;">${escapeHtml(title)}</td></tr>
<tr><td style="padding:18px 32px 0;font-size:15px;line-height:1.6;color:#211E4E;">${greeting}</td></tr>
<tr><td style="padding:14px 32px 0;">${body}${facts}</td></tr>
${action}
<tr><td style="padding:22px 32px 28px;font-size:12px;line-height:1.5;color:#6E6A86;">${footerBits.filter(Boolean).join("<br>")}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  const text = [
    "Influrios",
    group,
    title,
    "",
    first ? `Hi ${first},` : "Hello,",
    "",
    ...paragraphs.flatMap((paragraph) => [paragraph, ""]),
    ...copy.facts.flatMap(([label, raw]) => {
      const value = fillTemplate(raw, context, skeleton);
      return !skeleton && !value.trim() ? [] : [`${label}: ${value}`];
    }),
    "",
    copy.cta && copy.cta_url ? `${fillTemplate(copy.cta, context, skeleton)}: ${fillTemplate(copy.cta_url, context, skeleton)}` : "",
    "",
    footerBits.join("\n"),
  ]
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n")
    .trim();
  return { subject, html, text, preheader };
}

export function emailCopyFromCatalog(template: EmailCatalogTemplate): EmailCopy {
  return {
    id: template.id,
    group: template.group,
    audience: template.audience,
    category: template.category,
    subject: template.subject,
    preheader: template.preheader,
    title: template.title,
    body: template.body,
    cta: template.cta,
    cta_url: template.cta_url,
    facts: template.facts,
  };
}

function money(amount: string) {
  return `USD ${amount}`;
}

export function emailPreviewContext(templates: EmailCatalogTemplate[]) {
  const variables = new Set(templates.flatMap((template) => template.variables));
  const context: Record<string, string> = {};
  for (const name of variables) {
    context[name] = name.replaceAll("_", " ");
  }
  Object.assign(context, {
    first_name: "Alex",
    support_url: "https://influrios.example/support",
    preference_url: "https://influrios.example/account/notifications",
    unsubscribe_url: "https://influrios.example/unsubscribe/preview",
    sender_legal_name: "Influrios, Inc.",
    sender_postal_address: "548 Market Street, PMB 00000, San Francisco, CA 94104",
    business_name: "Northwind Studio",
    influencer_name: "Alex Rivera",
    collaboration_title: "Spring product launch",
    collaboration_reference: "COL-20418",
    milestone_title: "Concept delivery",
    quote_number: "Q-20418",
    currency: "USD",
    gross_amount: money("1,050.00"),
    business_fee: money("50.00"),
    influencer_fee: money("25.00"),
    activation_fee: money("10.00"),
    total_charged: money("1,050.00"),
    milestone_gross: money("400.00"),
    milestone_fee: money("10.00"),
    net_payout: money("390.00"),
    payout_amount: money("390.00"),
    refund_amount: money("624.00"),
    retained_amount: money("426.00"),
    held_amount: money("1,050.00"),
    fee_amount: money("15.00"),
    amount: money("1,050.00"),
    previous_total: money("1,050.00"),
    new_total: money("1,200.00"),
    difference: money("150.00"),
    last4: "4242",
    provider_reference: "preview-reference",
    failure_reason: "The payout account could not accept this transfer.",
    return_reason: "The receiving account rejected the transfer.",
    case_reference: "CASE-20418",
    resolution_summary: "The submitted work was accepted and the held amount stays in the collaboration.",
    reason: "The scope changed before work was accepted.",
    decision_deadline: "November 18, 2026 at 5:00 PM CST",
    funding_deadline: "November 18, 2026 at 5:00 PM CST",
    review_deadline: "November 18, 2026 at 5:00 PM CST",
    revision_deadline: "November 18, 2026 at 5:00 PM CST",
    response_deadline: "November 18, 2026 at 5:00 PM CST",
    expires_at: "November 18, 2026 at 5:00 PM CST",
    next_attempt_date: "November 18, 2026",
    renewal_date: "December 12, 2026",
    period_end: "December 12, 2026",
    plan_name: "Creator Pro",
    claim_url: "https://influrios.example/preview/claim",
    invite_url: "https://influrios.example/preview/invite",
    contract_url: "https://influrios.example/preview/contract",
    funding_url: "https://influrios.example/preview/funding",
    review_url: "https://influrios.example/preview/review",
    revision_url: "https://influrios.example/preview/revision",
    payout_url: "https://influrios.example/preview/payout",
    dispute_url: "https://influrios.example/preview/dispute",
    billing_url: "https://influrios.example/preview/billing",
    account_url: "https://influrios.example/preview/account",
    admin_url: "https://influrios.example/preview/admin",
    message_excerpt: "Can we move the delivery date to Friday?",
    revision_note: "Please crop the opening frame and resubmit.",
    verification_code: "482 619",
  });
  for (const template of templates) {
    context.action_url = `https://influrios.example/preview/${template.id}`;
    if (template.id === "account.verify" || template.id === "account.reset") {
      context.expires_at = "November 12, 2026 at 10:30 AM CST";
    }
  }
  return context;
}

export function renderCatalogPreview(template: EmailCatalogTemplate, copy?: Partial<EmailCopy>) {
  const base = emailCopyFromCatalog(template);
  const merged: EmailCopy = {
    ...base,
    ...copy,
    body: copy?.body ?? base.body,
    facts: base.facts,
    cta_url: base.cta_url,
    group: base.group,
    category: base.category,
    audience: base.audience,
    id: base.id,
  };
  const context = emailPreviewContext([template]);
  const missing = new Set<string>();
  const texts = [merged.subject, merged.preheader, merged.title, merged.cta, ...merged.body, ...merged.facts.map((row) => row[1])];
  for (const text of texts) {
    for (const name of placeholdersIn(text)) {
      if (!(name in context)) missing.add(name);
    }
  }
  for (const name of missing) context[name] = name.replaceAll("_", " ");
  return renderEmail({ copy: merged, context, hosts: ["influrios.example"] });
}
