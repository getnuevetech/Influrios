import catalogJson from "@/data/email-catalog.json";

export type EmailCatalogTemplate = {
  id: string;
  group: string;
  audience: string;
  trigger: string;
  subject: string;
  preheader: string;
  title: string;
  body: string[];
  cta: string;
  cta_url: string | null;
  facts: [string, string][];
  category: string;
  guard: string;
  version: number;
  enabled: boolean;
  variables: string[];
};

const catalog = catalogJson as unknown as {
  templates: Array<Omit<EmailCatalogTemplate, "facts"> & { facts: string[][] }>;
};

export const EMAIL_SYSTEM_VARIABLES = [
  "first_name",
  "support_url",
  "preference_url",
  "unsubscribe_url",
  "sender_legal_name",
  "sender_postal_address",
  "action_url",
] as const;

export const EMAIL_GROUP_LABELS: Record<string, string> = {
  account: "Your account",
  invite: "Your invitations",
  contract: "Your agreement",
  funding: "Collaboration funding",
  milestone: "Your collaboration",
  payout: "Payout update",
  dispute: "Case update",
  cancellation: "Cancellation update",
  refund: "Refund update",
  payment: "Payment update",
  ops: "Operations alert",
  billing: "Subscription billing",
  marketing: "From Influrios",
};

function asTemplate(row: Omit<EmailCatalogTemplate, "facts"> & { facts: string[][] }): EmailCatalogTemplate {
  return {
    ...row,
    facts: row.facts.map((pair) => [pair[0] ?? "", pair[1] ?? ""]),
  };
}

export function listEmailCatalog(): EmailCatalogTemplate[] {
  return catalog.templates.map(asTemplate);
}

export function emailCatalogTemplate(id: string) {
  const row = catalog.templates.find((item) => item.id === id);
  return row ? asTemplate(row) : null;
}

export function emailGroupLabel(group: string) {
  return EMAIL_GROUP_LABELS[group] ?? group;
}

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

export function placeholdersIn(value: string) {
  return [...value.matchAll(PLACEHOLDER)].map((match) => match[1]);
}

export function emailCopyProblems(input: {
  template: EmailCatalogTemplate;
  subject: string;
  preheader: string;
  headline: string;
  body: string[];
  cta: string;
}) {
  const problems: string[] = [];
  const subject = input.subject.trim();
  if (!subject) problems.push("A subject is required.");
  if (/[\r\n]/.test(subject)) problems.push("The subject cannot contain a line break.");
  if (!input.headline.trim()) problems.push("A headline is required.");
  if (input.body.every((paragraph) => !paragraph.trim())) problems.push("Write at least one paragraph.");
  const allowed = new Set([...input.template.variables, ...EMAIL_SYSTEM_VARIABLES]);
  const used = [
    subject,
    input.preheader,
    input.headline,
    input.cta,
    ...input.body,
  ].flatMap(placeholdersIn);
  const unknown = [...new Set(used.filter((name) => !allowed.has(name)))];
  if (unknown.length > 0) problems.push(`Unknown placeholder: ${unknown.join(", ")}.`);
  return problems;
}
