import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { actionSubmitContractWizard } from "@/app/collaboration/contract/actions";
import { getAccountSession } from "@/lib/accounts";
import { getBusinessEntitlements } from "@/lib/business-entitlements";
import { getWorkspace } from "@/lib/business";
import { resolveFee } from "@/lib/collaboration-fees";
import {
  buildFinancialPlan,
  CONTRACT_WIZARD_STEPS,
  countryCodeFromLocation,
  customMilestonesGate,
  evaluatePreContractGates,
  isContractWizardStep,
  type ContractWizardStep,
  type MilestoneDraft,
} from "@/lib/contract-wizard";
import { prisma } from "@/lib/db";
import { getDirectoryCreator, listDirectoryCreators } from "@/lib/directory";
import { hasCurrentLegalRecord } from "@/lib/legal";
import { formatMoney } from "@/lib/money";
import { ensureMarketplaceDefaults, marketplaceConfig } from "@/lib/marketplace-ledger";
import { paymentRoutes } from "@/lib/providers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contract & Milestone Wizard · Influrios" };

type Props = {
  searchParams: Promise<{
    step?: string;
    creator?: string;
    title?: string;
    scope?: string;
    commercial?: string;
    jurisdiction?: string;
    gross?: string;
    mode?: string;
    influencerAccepted?: string;
    accepted?: string;
    error?: string;
  }>;
};

const STEP_LABELS: Record<ContractWizardStep, string> = {
  parties: "Parties",
  scope: "Scope",
  commercial: "Commercial",
  milestones: "Milestones",
  payment_readiness: "Readiness",
  preview: "Preview",
  accept: "Accept",
  funding: "Funding",
};

function dollarsToCents(raw: string) {
  const amount = Number(String(raw).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

export default async function ContractWizardPage({ searchParams }: Props) {
  const params = await searchParams;
  const account = await getAccountSession().catch(() => null);
  if (!account) {
    redirect(`/login?next=${encodeURIComponent("/collaboration/contract")}&gate=business`);
  }

  const termsOk = await hasCurrentLegalRecord({
    documentKey: "business-terms",
    userId: account.id,
  }).catch(() => false);
  if (!termsOk) {
    redirect(
      `/collaboration/business?error=${encodeURIComponent("Agree to the Business / Brand Terms before starting a contract.")}`,
    );
  }

  const step: ContractWizardStep = isContractWizardStep(params.step ?? "")
    ? (params.step as ContractWizardStep)
    : "parties";
  const stepIndex = CONTRACT_WIZARD_STEPS.indexOf(step);

  const ws = await getWorkspace();
  const entitlements = getBusinessEntitlements(ws.plan);
  await ensureMarketplaceDefaults();
  const [config, creators, routes] = await Promise.all([
    marketplaceConfig(),
    listDirectoryCreators().catch(() => []),
    paymentRoutes().catch(() => []),
  ]);

  const creatorSlug = (params.creator ?? "").trim();
  const creator = creatorSlug ? await getDirectoryCreator(creatorSlug) : null;
  const title = params.title ?? "";
  const scope = params.scope ?? "";
  const commercial = params.commercial ?? "Paid brand partnership";
  const jurisdictionCode = (params.jurisdiction ?? "US").toUpperCase();
  const grossRaw = params.gross ?? "5000";
  const grossCents = dollarsToCents(grossRaw);
  const usingCustom = params.mode === "custom" && entitlements.customMilestones;
  const influencerAccepted = params.influencerAccepted === "1";
  const partyAccepted = params.accepted === "1";

  const templates: MilestoneDraft[] = (config.templates ?? [])
    .filter((row) => row.active)
    .map((row) => ({ title: row.title, shareBps: row.shareBps }));
  const customDefault: MilestoneDraft[] = [
    { title: "Kickoff brief", shareBps: 2500 },
    { title: "Content draft", shareBps: 2500 },
    { title: "Revisions", shareBps: 2500 },
    { title: "Published live", shareBps: 2500 },
  ];
  const drafts = usingCustom ? customDefault : templates.length ? templates : customDefault;

  const creatorCountry =
    countryCodeFromLocation(creator?.locationCountry) ??
    (creatorSlug && jurisdictionCode.length === 2 ? jurisdictionCode : null);
  const route = creatorCountry ? routes.find((row) => row.countryCode === creatorCountry) : undefined;
  const dbCreator = creatorSlug
    ? await prisma.creator.findUnique({ where: { slug: creatorSlug } }).catch(() => null)
    : null;
  const identityVerified =
    dbCreator?.identityVerified === "VERIFIED" ||
    dbCreator?.profileState === "VERIFIED" ||
    Boolean(creator?.verified);

  const jurisdiction = config.jurisdictions.find((row) => row.code === jurisdictionCode);
  const provider =
    config.providers.find((row) => row.code === (jurisdiction?.providerCode || "primary")) ?? config.provider;

  const gates = evaluatePreContractGates({
    businessName: ws.name,
    creatorSlug: creatorSlug || "",
    identityVerified: creatorSlug ? identityVerified : false,
    creatorCountryKnown: Boolean(creatorCountry),
    paymentRouteReady: Boolean(route?.ready),
    jurisdictionProtectedPayments: Boolean(jurisdiction?.protectedPaymentsEnabled),
    marketplaceProviderReady: Boolean(provider?.ready),
  });

  const milestoneGate = customMilestonesGate({
    entitled: entitlements.customMilestones,
    usingCustom,
    milestones: drafts,
    influencerAccepted,
  });

  const quote =
    grossCents > 0
      ? await resolveFee({
          jurisdiction: jurisdictionCode,
          serviceLevel: "contracted",
          grossValueCents: grossCents,
        }).catch(() => null)
      : null;

  const plan =
    grossCents > 0 && milestoneGate.ok
      ? buildFinancialPlan({
          grossCents,
          currency: jurisdiction?.currency ?? "USD",
          feeRuleId: quote?.rule?.id ?? null,
          feeRuleVersion: quote?.rule?.version ?? null,
          feeMethod: quote?.rule?.method ?? null,
          feePercentBps: quote?.rule?.percentBps ?? null,
          feeFixedCents: quote?.rule?.fixedCents ?? null,
          totalPlatformFeeCents: quote?.feeCents ?? 0,
          feePayer: quote?.rule?.payer ?? "brand",
          fundingCountry: jurisdictionCode,
          creatorCountry: creatorCountry ?? jurisdictionCode,
          payoutCurrency: jurisdiction?.currency ?? "USD",
          milestones: drafts,
          milestoneSource: usingCustom ? "custom" : "template",
        })
      : null;

  const shortlisted = ws.shortlist
    .map((item) => creators.find((c) => c.slug === item.creatorSlug))
    .filter(Boolean);
  const influencerOptions = (shortlisted.length ? shortlisted : creators.filter((c) => c.openToCollab).slice(0, 40)).filter(
    Boolean,
  );

  return (
    <div className="bg-[#F4F7FF]">
      <section className="border-b border-[#E4E9F5] bg-gradient-to-r from-[#EEF5FF] via-white to-[#F7F4FF]">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-violet">
            Contract & milestone wizard
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-indigo">Form the collaboration</h1>
          <p className="mt-2 text-sm text-muted">
            Parties → scope → commercial → milestones → payment readiness → preview → accept → funding.
            Custom milestones need Business Pro/Agency and influencer accept.
          </p>
          <Link href="/collaboration/business" className="mt-2 inline-flex text-xs font-bold text-violet hover:underline">
            ← Business Hub
          </Link>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <ol className="mb-6 flex flex-wrap gap-1.5">
          {CONTRACT_WIZARD_STEPS.map((key, index) => (
            <li
              key={key}
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                index <= stepIndex ? "bg-violet text-white" : "border border-[#E4E9F5] bg-white text-muted"
              }`}
            >
              {index + 1}. {STEP_LABELS[key]}
            </li>
          ))}
        </ol>

        {params.error ? (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
            {params.error}
          </p>
        ) : null}

        <form action={actionSubmitContractWizard} className="space-y-8 rounded-2xl border border-[#E4E9F5] bg-white p-6 shadow-sm">
          <input type="hidden" name="businessName" value={ws.name} />

          <section id="parties">
            <h2 className="font-display text-xl font-bold text-indigo">1. Parties</h2>
            <p className="mt-1 text-sm text-muted">
              Business: <strong>{ws.name}</strong> · plan {ws.plan.replace(/_/g, " ")}
            </p>
            <label className="mt-4 block text-sm font-semibold text-indigo">
              Influencer
              <select
                name="creatorSlug"
                required
                defaultValue={creatorSlug}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
              >
                <option value="">Select influencer…</option>
                {influencerOptions.map((c) =>
                  c ? (
                    <option key={c.slug} value={c.slug}>
                      {c.displayName} · {c.locationCity || "—"}, {c.locationCountry || "—"}
                    </option>
                  ) : null,
                )}
              </select>
            </label>
            {creator ? (
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-[#F4F7FF] p-3">
                <span className="relative h-12 w-12 overflow-hidden rounded-full">
                  <Image src={creator.image} alt="" fill className="object-cover" sizes="48px" />
                </span>
                <div>
                  <p className="text-sm font-bold text-indigo">{creator.displayName}</p>
                  <p className="text-xs text-muted">
                    {identityVerified ? "Identity verified" : "Identity not verified"} ·{" "}
                    {creatorCountry ?? "country unknown"}
                  </p>
                </div>
              </div>
            ) : null}
          </section>

          <section id="scope">
            <h2 className="font-display text-xl font-bold text-indigo">2. Scope</h2>
            <label className="mt-4 block text-sm font-semibold text-indigo">
              Campaign title
              <input
                name="title"
                required
                defaultValue={title || (creator ? `${ws.name} × ${creator.displayName}` : "")}
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
              />
            </label>
            <label className="mt-4 block text-sm font-semibold text-indigo">
              Deliverables, channels, usage & revisions
              <textarea
                name="scope"
                required
                rows={4}
                defaultValue={
                  scope || "Deliverables, channels, usage rights, and revision limits for this collaboration."
                }
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
              />
            </label>
          </section>

          <section id="commercial">
            <h2 className="font-display text-xl font-bold text-indigo">3. Commercial terms</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-indigo">
                Gross value (USD)
                <input
                  name="grossUsd"
                  required
                  defaultValue={grossRaw}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
                />
              </label>
              <label className="block text-sm font-semibold text-indigo">
                Jurisdiction
                <select
                  name="jurisdictionCode"
                  defaultValue={jurisdictionCode}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
                >
                  {config.jurisdictions.map((row) => (
                    <option key={row.code} value={row.code}>
                      {row.label} ({row.currency})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-indigo sm:col-span-2">
                Commercial framing
                <input
                  name="commercial"
                  defaultValue={commercial}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal outline-none focus:ring-2 focus:ring-violet"
                />
              </label>
            </div>
          </section>

          <section id="milestones">
            <h2 className="font-display text-xl font-bold text-indigo">4. Milestones</h2>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2 font-semibold text-indigo">
                <input type="radio" name="milestoneMode" value="template" defaultChecked={!usingCustom} />
                Admin templates
              </label>
              <label
                className={`inline-flex items-center gap-2 font-semibold ${
                  entitlements.customMilestones ? "text-indigo" : "text-muted"
                }`}
              >
                <input
                  type="radio"
                  name="milestoneMode"
                  value="custom"
                  defaultChecked={usingCustom}
                  disabled={!entitlements.customMilestones}
                />
                Custom schedule{!entitlements.customMilestones ? " (Pro/Agency)" : ""}
              </label>
            </div>
            <ul className="mt-4 space-y-2">
              {drafts.map((row, index) => (
                <li key={`${row.title}-${index}`} className="grid grid-cols-[1fr_88px] gap-2">
                  <input
                    name="milestoneTitle"
                    defaultValue={row.title}
                    className="rounded-xl border border-border px-3 py-2 text-sm"
                  />
                  <input
                    name="milestonePercent"
                    defaultValue={(row.shareBps / 100).toFixed(0)}
                    aria-label="Percent"
                    className="rounded-xl border border-border px-3 py-2 text-sm"
                  />
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">Percents must total 100. Last share absorbs rounding.</p>
            {entitlements.customMilestones ? (
              <label className="mt-4 flex items-start gap-2 text-sm text-indigo">
                <input
                  type="checkbox"
                  name="influencerAccepted"
                  defaultChecked={influencerAccepted}
                  className="mt-0.5 accent-violet"
                />
                <span>Influencer accepted this custom milestone schedule (required when using custom).</span>
              </label>
            ) : null}
            {!milestoneGate.ok ? (
              <p className="mt-3 text-sm font-semibold text-amber-800">{milestoneGate.error}</p>
            ) : null}
          </section>

          <section id="payment_readiness">
            <h2 className="font-display text-xl font-bold text-indigo">5. Payment readiness</h2>
            <p className="mt-1 text-sm text-muted">
              Status:{" "}
              <strong className={gates.ok ? "text-emerald-700" : "text-amber-800"}>{gates.status}</strong>
            </p>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              <li>Identity: {creatorSlug ? (identityVerified ? "verified" : "not verified") : "select influencer"}</li>
              <li>Payout country: {creatorCountry ?? "unknown"}</li>
              <li>
                Payment route:{" "}
                {route?.ready ? `ready (${route.providerName})` : route ? route.reason.replace(/_/g, " ") : "no route"}
              </li>
              <li>Jurisdiction protected payments: {jurisdiction?.protectedPaymentsEnabled ? "on" : "off"}</li>
              <li>Marketplace provider: {provider?.ready ? "ready" : "not ready"}</li>
            </ul>
            {!gates.ok ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm font-semibold text-amber-900">
                {gates.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm font-semibold text-emerald-800">ROUTE_READY — funding is allowed.</p>
            )}
          </section>

          <section id="preview">
            <h2 className="font-display text-xl font-bold text-indigo">6. Contract preview</h2>
            {plan ? (
              <>
                <p className="mt-1 text-sm text-muted">
                  Fee rule {plan.feeRuleId ?? "none"} v{plan.feeRuleVersion ?? "—"} · freezes on funding.
                  Later fee rule edits do not change locked deals.
                </p>
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted">Gross</dt>
                    <dd className="font-bold text-indigo">
                      {formatMoney(plan.grossContractValueCents, plan.contractCurrency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Platform fee</dt>
                    <dd className="font-bold text-indigo">
                      {formatMoney(plan.totalPlatformFeeCents, plan.contractCurrency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Influencer compensation</dt>
                    <dd className="font-bold text-indigo">
                      {formatMoney(plan.totalCreatorCompensationCents, plan.contractCurrency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Milestone source</dt>
                    <dd className="font-bold text-indigo">{plan.milestoneSource}</dd>
                  </div>
                </dl>
                <ul className="mt-4 space-y-2">
                  {plan.milestones.map((m) => (
                    <li
                      key={m.title}
                      className="flex justify-between gap-3 rounded-xl bg-[#F4F7FF] px-3 py-2 text-sm"
                    >
                      <span className="font-semibold text-indigo">
                        {m.title} · {(m.shareBps / 100).toFixed(0)}%
                      </span>
                      <span className="text-muted">
                        {formatMoney(m.grossCents, plan.contractCurrency)} (fee{" "}
                        {formatMoney(m.platformFeeCents, plan.contractCurrency)})
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">Complete parties, commercial terms, and valid milestones to preview.</p>
            )}
          </section>

          <section id="accept">
            <h2 className="font-display text-xl font-bold text-indigo">7. Accept & funding instruction</h2>
            <label className="mt-3 flex items-start gap-2 text-sm text-indigo">
              <input
                type="checkbox"
                name="partyAccepted"
                defaultChecked={partyAccepted}
                className="mt-0.5 accent-violet"
              />
              <span>
                I accept this financial plan on behalf of {ws.name}. Funding freezes the fee rule version and milestone
                schedule into an immutable snapshot.
              </span>
            </label>
          </section>

          <div className="flex flex-col gap-3 border-t border-[#E4E9F5] pt-4 sm:flex-row">
            <button type="submit" name="intent" value="preview" className="btn-secondary flex-1">
              Refresh preview
            </button>
            <button type="submit" name="intent" value="fund" className="btn-primary flex-1">
              Accept & request funding →
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          After funding is requested, manage milestones on{" "}
          <Link href="/payments" className="font-semibold text-violet hover:underline">
            Protected Payments
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
