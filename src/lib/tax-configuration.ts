/**
 * Tax is configured per subject. A fee setup does not cover influencer services.
 * An unsuccessful calculation is never stored or shown as zero tax.
 * Activating a configuration does not enable collaboration funding.
 */

export const TAX_COPY = {
  unavailable: "This plan is temporarily unavailable.",
  address: "Add your billing address to calculate tax.",
  provider: "We couldn't calculate tax. Nothing was charged.",
  atCheckout: "Tax calculated at checkout",
  legalNote: "This preview validates the integration response. It does not establish that the legal classification is correct.",
  activationLimit: "Activation applies only to this scope. It does not enable collaboration funding or change signed financial records.",
} as const;

export const TAX_SUBJECTS = [
  { id: "subscription", label: "Subscription" },
  { id: "business_fee", label: "Business fee" },
  { id: "influencer_fee", label: "Influencer fee" },
  { id: "influencer_services", label: "Influencer services" },
] as const;

export type TaxSubject = (typeof TAX_SUBJECTS)[number]["id"];

export const TAX_STATUSES = [
  { id: "ready", label: "Ready" },
  { id: "draft", label: "Draft" },
  { id: "needs_review", label: "Needs review" },
] as const;

export type TaxDisplayStatus = (typeof TAX_STATUSES)[number]["id"];

export const CALCULATION_METHODS = [
  { id: "automatic", label: "Automatic provider calculation" },
  { id: "manual", label: "Approved manual configuration" },
] as const;

/** The method dropdown uses the provider name when that is what the list already calls the calculation. */
export function calculationChoices(providerCode: string) {
  const automatic = providerCode === "stripe" ? "Stripe Tax" : "Automatic provider calculation";
  return [
    { id: "automatic" as const, label: automatic },
    { id: "manual" as const, label: "Approved manual configuration" },
  ];
}

/** Fee rules are chosen by their name. An internal purpose code is not a label. */
export function feeRuleChoiceLabel(name: string, purpose: "business_fee" | "influencer_fee") {
  const text = name.trim().replace(/\s+·\s+(brand|influencer|business|payer)$/i, "");
  if (!text || text === "business_platform_fee" || text === "influencer_platform_fee") {
    return purpose === "business_fee" ? "Business fee" : "Influencer fee";
  }
  return text;
}

export type CalculationMethod = (typeof CALCULATION_METHODS)[number]["id"];

export const PRICE_DISPLAY = [
  { id: "exclusive", label: "Tax added at checkout" },
  { id: "inclusive", label: "Tax included in price" },
] as const;

export const RESPONSIBLE_ENTITIES = [
  { id: "platform", label: "Influrios platform", detail: "The platform has the collection and reporting obligation." },
  { id: "connected_account", label: "Connected account", detail: "The connected account has the collection and reporting obligation." },
] as const;

export type ResponsibleEntity = (typeof RESPONSIBLE_ENTITIES)[number]["id"];

/** Provider product tax categories. Labels follow Stripe's published tax codes. */
export const TAX_CATEGORIES = [
  { id: "txcd_10103000", label: "Software as a service, personal use" },
  { id: "txcd_10103001", label: "Software as a service, business use" },
  { id: "txcd_10103100", label: "Software as a service, download, personal use" },
  { id: "txcd_10103101", label: "Software as a service, download, business use" },
  { id: "txcd_10000000", label: "General electronically supplied services" },
  { id: "txcd_10701000", label: "Website advertising" },
  { id: "txcd_20060002", label: "Advertising services" },
  { id: "txcd_20030000", label: "General services" },
] as const;

export const INFLUENCER_SERVICE_SUBJECTS = [
  { id: "service_compensation", label: "Influencer service compensation" },
] as const;

export const REGION_REQUIRED = new Set(["US", "CA", "AU", "IN", "BR", "MX"]);

const SUBJECT_ROLE: Record<TaxSubject, string> = {
  subscription: "subscriber",
  business_fee: "business",
  influencer_fee: "influencer",
  influencer_services: "services",
};

export function adminTaxFieldLabels() {
  return [
    "Applies to",
    "Products",
    "Fee rules",
    "Country",
    "State or region",
    "Environment",
    "Calculation method",
    "Product tax category",
    "Price display",
    "Tax rate (%)",
    "Jurisdiction",
    "Effective date",
    "End date",
  ];
}

export function isTaxSubject(value: string): value is TaxSubject {
  return TAX_SUBJECTS.some((item) => item.id === value);
}

export function subjectLabel(value: string) {
  return TAX_SUBJECTS.find((item) => item.id === value)?.label ?? "Not configured";
}

export function isApprovedEntity(value: string): value is ResponsibleEntity {
  return RESPONSIBLE_ENTITIES.some((item) => item.id === value);
}

export function entityLabel(value: string) {
  return RESPONSIBLE_ENTITIES.find((item) => item.id === value)?.label ?? "Not selected";
}

export function categoryLabel(value: string) {
  return TAX_CATEGORIES.find((item) => item.id === value)?.label ?? "";
}

export function displayStatus(status: string): TaxDisplayStatus {
  if (status === "ready" || status === "active") return "ready";
  if (status === "needs_review") return "needs_review";
  return "draft";
}

export function rowAction(status: TaxDisplayStatus) {
  if (status === "ready") return "View setup";
  if (status === "needs_review") return "Review treatment";
  return "Continue setup";
}

/** A role label for the selected scope. It is not a payment-integration or provider-account choice. */
export function scopeAccountLabel(appliesTo: string, environment: string) {
  const role = appliesTo === "subscription" ? "Subscription account" : "Collaboration account";
  return `${role} · ${environment === "live" ? "Live" : "Sandbox"}`;
}

export function calculationLabel(method: string) {
  if (method === "automatic") return "Tax added to the price";
  if (method === "manual") return "Approved manual rate";
  return "Not configured";
}

export function regionRequired(countryCode: string) {
  return REGION_REQUIRED.has(countryCode.trim().toUpperCase());
}

/** Percent entered by an admin. Stored later as an integer rate. The screen never says basis points. */
export function parseTaxPercent(value: string): number | null {
  const text = value.trim().replace(/%$/, "");
  if (!text) return null;
  if (!/^\d+(\.\d{1,3})?$/.test(text)) return null;
  const percent = Number(text);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) return null;
  return percent;
}

export function percentToStoredRate(percent: number) {
  return Math.round(percent * 100);
}

export function storedRateToPercent(rate: number | null) {
  if (rate == null) return "";
  const percent = rate / 100;
  return percent.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export function parseMoneyToCents(value: string): number | null {
  const text = value.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const cents = Math.round(Number(text) * 100);
  if (!Number.isInteger(cents) || cents < 0) return null;
  return cents;
}

export type PlanTaxGate =
  | { kind: "free"; cancelsPaidSubscription: false }
  | { kind: "unavailable"; message: typeof TAX_COPY.unavailable; missing: string }
  | { kind: "checkout"; message: typeof TAX_COPY.atCheckout };

/** Each plan is judged on its own. A free plan never waits on another plan's tax setup. */
export function planTaxGate(input: { amountCents: number; checkout: boolean; gaps: string[] }): PlanTaxGate {
  if (input.amountCents <= 0 || input.checkout === false) {
    return { kind: "free", cancelsPaidSubscription: false };
  }
  const missing = input.gaps.find((gap) => gap.trim().length > 0) ?? "";
  if (missing) return { kind: "unavailable", message: TAX_COPY.unavailable, missing };
  return { kind: "checkout", message: TAX_COPY.atCheckout };
}

export function subscriptionGaps(input: {
  planKeys: string[];
  taxPolicyId?: string;
  policies: {
    id: string;
    appliesTo: string;
    status: string;
    linkedIds: string[];
    countryCode: string;
    regionCode: string;
    providerCode: string;
    providerAccountId: string;
    calculationMethod: string;
    taxCategory: string;
    liableEntity: string;
    rateBps: number | null;
    jurisdiction: string;
    hasEffectiveFrom: boolean;
  }[];
}): string[] {
  const keys = new Set(input.planKeys.filter(Boolean));
  const policy = input.policies.find((row) => {
    const ready = row.status === "ready" || row.status === "active";
    if (!ready || row.appliesTo !== "subscription") return false;
    if (input.taxPolicyId && row.id === input.taxPolicyId) return true;
    return row.linkedIds.some((id) => keys.has(id));
  });
  if (!policy) return ["Tax configuration for this plan"];
  return configurationGaps(policy);
}

export function configurationGaps(policy: {
  appliesTo: string;
  linkedIds: string[];
  countryCode: string;
  regionCode: string;
  calculationMethod: string;
  taxCategory: string;
  liableEntity: string;
  rateBps: number | null;
  jurisdiction: string;
  hasEffectiveFrom: boolean;
}): string[] {
  const gaps: string[] = [];
  if (!isTaxSubject(policy.appliesTo)) gaps.push("Applies to");
  if (policy.linkedIds.length === 0) gaps.push(policy.appliesTo === "subscription" ? "Products" : "Product or fee rule");
  if (!/^[A-Z]{2}$/.test(policy.countryCode.trim().toUpperCase())) gaps.push("Country");
  if (regionRequired(policy.countryCode) && !policy.regionCode.trim()) gaps.push("State or region");
  if (policy.calculationMethod !== "automatic" && policy.calculationMethod !== "manual") gaps.push("Calculation method");
  if (!categoryLabel(policy.taxCategory)) gaps.push("Product tax category");
  if (policy.calculationMethod === "manual") {
    if (policy.rateBps == null) gaps.push("Tax rate (%)");
    if (!policy.jurisdiction.trim()) gaps.push("Jurisdiction");
    if (!policy.hasEffectiveFrom) gaps.push("Effective date");
  }
  if (policy.calculationMethod === "automatic" && policy.rateBps != null) gaps.push("Manual rate on an automatic configuration");
  return gaps;
}

export function subjectCovers(appliesTo: string, other: string) {
  return isTaxSubject(appliesTo) && appliesTo === other;
}

export type TaxListRow = {
  id: string;
  appliesTo: string;
  appliesLabel: string;
  calculation: string;
  account: string;
  status: TaxDisplayStatus;
  action: string;
  countryCode: string;
  search: string;
};

export function buildTaxRows(records: {
  id: string;
  appliesTo: string;
  calculationMethod: string;
  providerCode: string;
  accountLabel: string;
  status: string;
  countryCode: string;
  name: string;
}[]): TaxListRow[] {
  const chosen: (typeof records)[number][] = [];
  const seen = new Set<string>();
  for (const record of records) {
    if (!isTaxSubject(record.appliesTo)) continue;
    const key = `${record.appliesTo}:${record.countryCode.trim().toUpperCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    chosen.push(record);
  }
  const rows: TaxListRow[] = chosen.map((record) => {
    const status = displayStatus(record.status);
    const appliesLabel = subjectLabel(record.appliesTo);
    const countryCode = record.countryCode.trim().toUpperCase();
    return {
      id: record.id,
      appliesTo: record.appliesTo,
      appliesLabel,
      calculation: calculationLabel(record.calculationMethod),
      account: record.accountLabel.trim() || "Not selected",
      status,
      action: rowAction(status),
      countryCode,
      search: `${appliesLabel} ${record.accountLabel} ${countryCode}`.toLowerCase(),
    };
  });
  for (const subject of TAX_SUBJECTS) {
    if (rows.some((row) => row.appliesTo === subject.id)) continue;
    rows.push({
      id: `missing:${subject.id}`,
      appliesTo: subject.id,
      appliesLabel: subject.label,
      calculation: "Not configured",
      account: "Not selected",
      status: "needs_review",
      action: "Review treatment",
      countryCode: "",
      search: subject.label.toLowerCase(),
    });
  }
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.appliesTo, (counts.get(row.appliesTo) ?? 0) + 1);
  for (const row of rows) {
    if ((counts.get(row.appliesTo) ?? 0) < 2 || !row.countryCode) continue;
    row.appliesLabel = `${subjectLabel(row.appliesTo)} · ${row.countryCode}`;
    row.search = `${row.appliesLabel} ${row.account} ${row.countryCode}`.toLowerCase();
  }
  const order = new Map(TAX_SUBJECTS.map((subject, index) => [subject.id, index]));
  return rows.sort((a, b) => (order.get(a.appliesTo as TaxSubject) ?? 9) - (order.get(b.appliesTo as TaxSubject) ?? 9) || a.countryCode.localeCompare(b.countryCode));
}

/** A country route is not a second tax setup. Missing tax there does not block every product. */
export function routeTaxNote(linked: boolean) {
  if (linked) {
    return "This route records one tax configuration. Other products keep their own setup. Linking it does not enable collaboration funding.";
  }
  return "No tax configuration is linked here. Set each product in Tax Settings. A missing setup does not block other products or the free plan, and an unresolved calculation is not stored as zero.";
}

export function reviewChecks(input: { productSelected: boolean; previewPassed: boolean }) {
  return [
    { label: "Product mapping complete", done: input.productSelected },
    { label: "Test passed", done: input.previewPassed },
  ];
}

export type CheckoutNoticeKind = "pending" | "address" | "unavailable" | "provider" | "zero" | "calculated" | "free";

/** One customer state at a time. A failed calculation is never the zero state. */
export function customerCheckoutNotice(preview: {
  ok: boolean;
  kind: string;
  taxCents: number | null;
  subtotalCents: number | null;
  totalCents: number | null;
} | null): CheckoutNoticeKind {
  if (!preview) return "pending";
  if (preview.kind === "free") return "free";
  if (preview.kind === "address") return "address";
  if (preview.kind === "provider") return "provider";
  if (preview.kind === "configuration") return "unavailable";
  const ready = preview.ok && preview.taxCents != null && preview.subtotalCents != null && preview.totalCents != null;
  if (ready && preview.taxCents === 0) return "zero";
  if (ready) return "calculated";
  return "pending";
}

export function filterTaxRows(rows: TaxListRow[], input: { query?: string; country?: string; status?: string }) {
  const query = input.query?.trim().toLowerCase() ?? "";
  const country = input.country?.trim().toUpperCase() ?? "";
  const status = input.status?.trim() ?? "";
  return rows.filter((row) => {
    if (query && !row.search.includes(query)) return false;
    if (country && country !== "ALL" && row.countryCode !== country) return false;
    if (status && status !== "all" && row.status !== status) return false;
    return true;
  });
}

export function statusCounts(rows: TaxListRow[]) {
  return {
    ready: rows.filter((row) => row.status === "ready").length,
    draft: rows.filter((row) => row.status === "draft").length,
    needsReview: rows.filter((row) => row.status === "needs_review").length,
  };
}

export type EligibleIntegration = { id: string; label: string };
export type EligibleAccount = { id: string; label: string; providerCode: string; environment: string };

export function eligiblePaymentIntegrations(rows: { providerCode: string; health: string; enabled: boolean }[]): EligibleIntegration[] {
  const stripeReady = rows.some((row) => row.enabled && row.providerCode === "stripe" && row.health !== "restricted");
  return stripeReady ? [{ id: "stripe", label: "Stripe" }] : [];
}

export function accountsFor(accounts: EligibleAccount[], providerCode: string, environment: string) {
  return accounts.filter((account) => account.providerCode === providerCode && account.environment === environment);
}

export type TaxDraftInput = {
  seriesName: string;
  appliesTo: string;
  linkedIds: string[];
  allowedIds: string[];
  countryCode: string;
  regionCode: string;
  environment: string;
  providerCode: string;
  providerAccountId: string;
  eligibleProviders: string[];
  eligibleAccountIds: string[];
  calculationMethod: string;
  taxCategory: string;
  priceDisplay: string;
  liableEntity: string;
  registrationStatus: string;
  filingArrangement: string;
  ratePercent: string;
  jurisdiction: string;
  effectiveFrom: string;
  effectiveTo: string;
  intent: "draft" | "activate";
};

export type PlannedTaxConfiguration = {
  name: string;
  appliesTo: TaxSubject;
  customerRole: string;
  linkedIds: string[];
  countryCode: string;
  regionCode: string;
  environment: "sandbox" | "live";
  providerCode: string;
  providerAccountId: string;
  calculationMethod: "" | CalculationMethod;
  taxCategory: string;
  inclusive: boolean;
  liableEntity: string;
  registrationStatus: string;
  filingArrangement: string;
  filingOwner: string;
  rateBps: number | null;
  jurisdiction: string;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  treatment: "taxable" | "unresolved";
  status: TaxDisplayStatus;
  planIds: string[];
  feeRuleIds: string[];
  serviceIds: string[];
  fundingEnabled: false;
  signedRecordsChanged: false;
  collaborationReadinessChanged: false;
};

function parseDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  const date = new Date(`${value.trim()}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function planTaxConfiguration(input: TaxDraftInput): { ok: true; planned: PlannedTaxConfiguration } | { ok: false; error: string } {
  if (!isTaxSubject(input.appliesTo)) return { ok: false, error: "Choose what this configuration applies to." };
  const linkedIds = [...new Set(input.linkedIds.map((id) => id.trim()).filter(Boolean))];
  const allowed = new Set(input.allowedIds);
  if (linkedIds.some((id) => !allowed.has(id))) {
    return { ok: false, error: "Choose a product or fee rule from the list for this scope." };
  }
  const countryCode = input.countryCode.trim().toUpperCase();
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) return { ok: false, error: "Choose a country." };
  const environment = input.environment === "live" ? "live" : "sandbox";
  const calculationMethod = input.calculationMethod.trim();
  if (calculationMethod && calculationMethod !== "automatic" && calculationMethod !== "manual") {
    return { ok: false, error: "Choose a calculation method." };
  }
  const taxCategory = input.taxCategory.trim();
  if (taxCategory && !categoryLabel(taxCategory)) return { ok: false, error: "Choose a product tax category." };
  const liableEntity = input.liableEntity.trim();
  if (liableEntity && !isApprovedEntity(liableEntity)) {
    return { ok: false, error: "Choose an approved tax-responsible entity. It cannot be typed in to finish checkout." };
  }
  void input.filingArrangement;
  const percent = parseTaxPercent(input.ratePercent);
  if (input.ratePercent.trim() && percent == null) return { ok: false, error: "Enter a tax rate as a percent." };
  if (calculationMethod === "automatic" && percent != null) {
    return { ok: false, error: "Automatic calculation does not use a manual rate." };
  }
  const priceDisplay = input.priceDisplay === "inclusive" ? "inclusive" : "exclusive";
  const effectiveFrom = parseDay(input.effectiveFrom);
  const effectiveTo = parseDay(input.effectiveTo);
  if (input.effectiveFrom.trim() && !effectiveFrom) return { ok: false, error: "Choose an effective date." };
  if (input.effectiveTo.trim() && !effectiveTo) return { ok: false, error: "Choose an end date." };
  if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) return { ok: false, error: "The end date is before the effective date." };
  const rateBps = calculationMethod === "manual" && percent != null ? percentToStoredRate(percent) : null;
  const gaps = configurationGaps({
    appliesTo: input.appliesTo,
    linkedIds,
    countryCode,
    regionCode: input.regionCode.trim(),
    calculationMethod,
    taxCategory,
    liableEntity,
    rateBps,
    jurisdiction: input.jurisdiction.trim(),
    hasEffectiveFrom: Boolean(effectiveFrom),
  });
  if (input.intent === "activate" && gaps.length > 0) {
    return { ok: false, error: `Add ${gaps[0]} before activation.` };
  }
  const status: TaxDisplayStatus =
    input.intent === "activate" ? "ready" : !calculationMethod || !taxCategory ? "needs_review" : "draft";
  const name = input.seriesName.trim() || `${subjectLabel(input.appliesTo)} · ${countryCode || "unspecified"} · ${linkedIds.slice().sort().join("+") || "unlinked"}`;
  return {
    ok: true,
    planned: {
      name,
      appliesTo: input.appliesTo,
      customerRole: SUBJECT_ROLE[input.appliesTo],
      linkedIds,
      countryCode,
      regionCode: input.regionCode.trim(),
      environment,
      providerCode: "",
      providerAccountId: "",
      calculationMethod: calculationMethod === "automatic" || calculationMethod === "manual" ? calculationMethod : "",
      taxCategory,
      inclusive: priceDisplay === "inclusive",
      liableEntity,
      registrationStatus: input.registrationStatus.trim() || "not_synced",
      filingArrangement: "",
      filingOwner: "",
      rateBps,
      jurisdiction: input.jurisdiction.trim(),
      effectiveFrom,
      effectiveTo,
      treatment: calculationMethod && taxCategory ? "taxable" : "unresolved",
      status,
      planIds: input.appliesTo === "subscription" ? linkedIds : [],
      feeRuleIds: input.appliesTo === "business_fee" || input.appliesTo === "influencer_fee" ? linkedIds : [],
      serviceIds: input.appliesTo === "influencer_services" ? linkedIds : [],
      fundingEnabled: false,
      signedRecordsChanged: false,
      collaborationReadinessChanged: false,
    },
  };
}

export function activationEffects(appliesTo: string) {
  return {
    fundingEnabled: false as const,
    signedRecordsChanged: false as const,
    collaborationReadinessChanged: false as const,
    scope: isTaxSubject(appliesTo) ? appliesTo : "",
  };
}

export function manualTaxAmount(input: { amountCents: number; rateBps: number | null; inclusive: boolean; jurisdiction: string }) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { ok: false as const, missing: "Example amount", taxCents: null, totalCents: null, subtotalCents: null, reason: "" };
  }
  if (input.rateBps == null || !Number.isInteger(input.rateBps) || input.rateBps < 0) {
    return { ok: false as const, missing: "Tax rate (%)", taxCents: null, totalCents: null, subtotalCents: null, reason: "" };
  }
  const where = input.jurisdiction.trim() || "the approved jurisdiction";
  if (input.rateBps === 0) {
    return {
      ok: true as const,
      taxCents: 0,
      subtotalCents: input.amountCents,
      totalCents: input.amountCents,
      reason: `Approved manual rate is 0% for ${where}.`,
    };
  }
  if (input.inclusive) {
    const taxCents = Math.round((input.amountCents * input.rateBps) / (10_000 + input.rateBps));
    return {
      ok: true as const,
      taxCents,
      subtotalCents: input.amountCents - taxCents,
      totalCents: input.amountCents,
      reason: `Approved manual rate, included in the price, for ${where}.`,
    };
  }
  const taxCents = Math.round((input.amountCents * input.rateBps) / 10_000);
  return {
    ok: true as const,
    taxCents,
    subtotalCents: input.amountCents,
    totalCents: input.amountCents + taxCents,
    reason: `Approved manual rate, added at checkout, for ${where}.`,
  };
}

const TAXABILITY_REASON: Record<string, string> = {
  standard_rated: "The provider applied its standard rate for this address.",
  not_collecting: "The provider is not collecting tax for this address.",
  not_subject_to_tax: "The provider marked this product as not subject to tax for this address.",
  not_supported: "The provider does not support tax for this address.",
  product_exempt: "The provider returned a product exemption.",
  customer_exempt: "The provider returned a customer exemption.",
  zero_rated: "The provider rated this supply at zero.",
  reverse_charge: "The provider applied reverse charge, so tax due at sale is zero.",
};

export function parseProviderTaxCalculation(payload: unknown):
  | { ok: true; taxCents: number; totalCents: number; reason: string }
  | { ok: false; detail: string } {
  if (!payload || typeof payload !== "object") {
    return { ok: false, detail: "The tax provider returned an unreadable calculation." };
  }
  const body = payload as Record<string, unknown>;
  if (body.error && typeof body.error === "object") {
    const message = (body.error as { message?: unknown }).message;
    return { ok: false, detail: typeof message === "string" && message.trim() ? message.trim() : "The tax provider rejected the calculation." };
  }
  const tax = body.tax_amount_exclusive;
  const total = body.amount_total;
  if (typeof tax !== "number" || typeof total !== "number" || !Number.isInteger(tax) || !Number.isInteger(total) || tax < 0 || total < 0) {
    return { ok: false, detail: "The tax provider returned an unreadable amount." };
  }
  const breakdown = Array.isArray(body.tax_breakdown) ? body.tax_breakdown : [];
  const first = breakdown.find((row) => row && typeof row === "object") as { taxability_reason?: unknown } | undefined;
  const code = typeof first?.taxability_reason === "string" ? first.taxability_reason : "";
  const reason = TAXABILITY_REASON[code] ?? (tax === 0 ? "The provider calculated no tax for this address." : "The provider calculated tax for this address.");
  return { ok: true, taxCents: tax, totalCents: total, reason };
}

export function parseRegistrationList(payload: unknown): "active" | "pending" | "none" | "unavailable" {
  if (!payload || typeof payload !== "object") return "unavailable";
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return "unavailable";
  if (data.length === 0) return "none";
  const statuses = data.map((row) => (row && typeof row === "object" && "status" in row ? String((row as { status: unknown }).status) : ""));
  if (statuses.includes("active")) return "active";
  if (statuses.some((status) => status === "scheduled" || status === "pending")) return "pending";
  return "none";
}

export type PreviewDecision = {
  ok: boolean;
  kind: "address" | "configuration" | "provider" | "calculated" | "not_calculated";
  customerMessage: string;
  correction: string;
  subtotalCents: number | null;
  taxCents: number | null;
  totalCents: number | null;
  reason: string;
  liableEntityLabel: string;
  legalNote: string;
};

export function decidePreview(input: {
  audience: "admin" | "customer";
  phase: "offer" | "calculate";
  method: string;
  addressReady: boolean;
  amountCents: number;
  rateBps: number | null;
  inclusive: boolean;
  jurisdiction: string;
  liableEntity: string;
  subjectSelected: boolean;
  providerResult: { ok: true; taxCents: number; totalCents: number; reason: string } | { ok: false; detail: string } | null;
}): PreviewDecision {
  const entity = entityLabel(input.liableEntity);
  const base = {
    liableEntityLabel: entity,
    legalNote: "",
    subtotalCents: null as number | null,
    taxCents: null as number | null,
    totalCents: null as number | null,
    reason: "",
    correction: "",
    customerMessage: "",
  };
  if (input.phase === "offer") {
    return { ...base, ok: true, kind: "not_calculated", customerMessage: TAX_COPY.atCheckout, reason: TAX_COPY.atCheckout };
  }
  if (!input.subjectSelected) {
    return { ...base, ok: false, kind: "configuration", customerMessage: TAX_COPY.unavailable, correction: "Select a product or fee rule." };
  }
  if (!input.addressReady) {
    return {
      ...base,
      ok: false,
      kind: "address",
      customerMessage: TAX_COPY.address,
      correction: "Enter the customer country, the state or region where one is required, and the postal code.",
    };
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { ...base, ok: false, kind: "configuration", customerMessage: TAX_COPY.unavailable, correction: "Enter an example amount greater than zero." };
  }
  if (input.method !== "automatic" && input.method !== "manual") {
    return { ...base, ok: false, kind: "configuration", customerMessage: TAX_COPY.unavailable, correction: "Choose a calculation method." };
  }
  if (input.method === "manual") {
    const manual = manualTaxAmount({
      amountCents: input.amountCents,
      rateBps: input.rateBps,
      inclusive: input.inclusive,
      jurisdiction: input.jurisdiction,
    });
    if (!manual.ok) {
      return { ...base, ok: false, kind: "configuration", customerMessage: TAX_COPY.unavailable, correction: `Add ${manual.missing} before running a manual preview.` };
    }
    return {
      ok: true,
      kind: "calculated",
      customerMessage: manual.taxCents === 0 ? "Tax $0.00" : "",
      correction: "",
      subtotalCents: manual.subtotalCents,
      taxCents: manual.taxCents,
      totalCents: manual.totalCents,
      reason: manual.reason,
      liableEntityLabel: entity,
      legalNote: TAX_COPY.legalNote,
    };
  }
  if (!input.providerResult) {
    return {
      ...base,
      ok: false,
      kind: "provider",
      customerMessage: TAX_COPY.provider,
      correction: "The tax provider did not return a calculation. Nothing was charged.",
    };
  }
  if (!input.providerResult.ok) {
    return {
      ...base,
      ok: false,
      kind: "provider",
      customerMessage: TAX_COPY.provider,
      correction: input.providerResult.detail || "The tax provider did not return a calculation. Nothing was charged.",
    };
  }
  const taxCents = input.providerResult.taxCents;
  const subtotalCents = input.inclusive ? input.providerResult.totalCents - taxCents : input.amountCents;
  return {
    ok: true,
    kind: "calculated",
    customerMessage: taxCents === 0 ? "Tax $0.00" : "",
    correction: "",
    subtotalCents,
    taxCents,
    totalCents: input.providerResult.totalCents,
    reason: input.providerResult.reason,
    liableEntityLabel: entity,
    legalNote: TAX_COPY.legalNote,
  };
}

export function billingAddressReady(input: { country: string; region: string; postalCode: string; line1: string; city: string; requireStreet: boolean }) {
  if (!/^[A-Za-z]{2}$/.test(input.country.trim())) return false;
  if (!input.postalCode.trim()) return false;
  if (regionRequired(input.country) && !input.region.trim()) return false;
  if (input.requireStreet && (!input.line1.trim() || !input.city.trim())) return false;
  return true;
}

export function reviewSummary(input: {
  appliesTo: string;
  countryName: string;
  method: string;
  providerLabel: string;
  accountLabel: string;
  environment: string;
  priceDisplay: string;
  category: string;
  gaps: string[];
}) {
  const subject = subjectLabel(input.appliesTo);
  const method = input.method === "automatic"
    ? "Tax added to the price"
    : input.method === "manual"
      ? "Approved manual configuration"
      : "Not chosen";
  return {
    lines: [
      { label: "Applies to", value: subject },
      { label: "Method", value: input.method === "automatic" ? "Stripe Tax" : method },
      { label: "Account", value: scopeAccountLabel(input.appliesTo, input.environment) },
      { label: "Country", value: input.countryName || "Not selected" },
      { label: "Environment", value: input.environment === "live" ? "Live" : "Sandbox" },
      { label: "Category", value: categoryLabel(input.category) || "Not selected" },
      { label: "Price display", value: PRICE_DISPLAY.find((item) => item.id === input.priceDisplay)?.label ?? "Tax added at checkout" },
    ],
    outstanding: input.gaps,
    notes: [
      TAX_COPY.activationLimit,
      TAX_COPY.legalNote,
      input.appliesTo === "influencer_services"
        ? "This covers tax on the influencer’s services. It does not change tax on Influrios fees."
        : input.appliesTo === "business_fee" || input.appliesTo === "influencer_fee"
          ? "This covers the Influrios fee. It does not set tax on the influencer’s services."
          : "This covers the selected subscription products only.",
    ],
  };
}

export function registrationLabel(status: string) {
  if (status === "active") return "Active";
  if (status === "pending") return "Pending";
  if (status === "none") return "No registration";
  if (status === "unavailable") return "Provider unavailable";
  return "Not synced";
}
