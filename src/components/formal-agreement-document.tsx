/**
 * Formal agreement layout for on-screen preview (matches approved specimen chrome)
 * while preserving the full stored agreement body (all numbered clauses).
 */
import type { ReactNode } from "react";
import { InfluriosWordmark } from "@/components/influrios-wordmark";
import {
  isFieldRow,
  parseAgreementBodySections,
  splitFieldRow,
  type AgreementBodySection,
} from "@/lib/contract-body-sections";

export type FormalAgreementParty = {
  role: "business" | "influencer";
  legalName: string;
  handle?: string;
  signerName?: string;
  capacity?: string;
  signedAtLabel?: string;
  signed?: boolean;
};

export type FormalAgreementMilestone = {
  title: string;
  shareLabel: string;
  grossLabel: string;
  feeLabel?: string;
  netLabel?: string;
};

export type FormalAgreementProps = {
  title: string;
  campaign: string;
  agreementRef: string;
  versionLabel: string;
  parties: FormalAgreementParty[];
  /** Full stored agreement text (signature tokens already stripped). */
  body: string;
  compensation: {
    grossLabel: string;
    feeLabel: string;
    taxLabel?: string;
    netLabel: string;
  };
  milestones: FormalAgreementMilestone[];
  showFeeColumns?: boolean;
  draft?: boolean;
  footerNote?: string;
};

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="bg-[#111A5A] px-3 py-1.5">
        <h3 className="font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-white">{heading}</h3>
      </div>
      <div className="mt-3 text-[13px] leading-relaxed text-[#1B1464]">{children}</div>
    </section>
  );
}

function BodyLines({ lines }: { lines: string[] }) {
  const nodes: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      nodes.push(<div key={`sp-${index}`} className="h-2" />);
      index += 1;
      continue;
    }
    if (line.trim().startsWith("- ") || line.trim().startsWith("· ")) {
      const items: string[] = [];
      while (
        index < lines.length &&
        (/^\s*[-·]\s+/.test(lines[index] ?? "") || (items.length > 0 && /^\s{2,}\S/.test(lines[index] ?? "")))
      ) {
        items.push((lines[index] ?? "").replace(/^\s*[-·]\s+/, "").trim());
        index += 1;
      }
      nodes.push(
        <ul key={`ul-${index}`} className="my-2 list-disc space-y-1 pl-5 font-sans">
          {items.map((item, itemIndex) => (
            <li key={`${item}-${itemIndex}`}>{item}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (isFieldRow(line)) {
      const rows: { label: string; value: string }[] = [];
      while (index < lines.length && isFieldRow(lines[index] ?? "")) {
        const split = splitFieldRow(lines[index] ?? "");
        if (split) rows.push(split);
        index += 1;
      }
      if (rows.length > 0) {
        nodes.push(
          <table key={`tbl-${index}`} className="my-2 w-full border-collapse font-sans text-[13px]">
            <tbody>
              {rows.map((row) => (
                <tr key={row.label + row.value} className="border-b border-[#E7ECF5]">
                  <td className="w-[42%] py-1.5 pr-3 align-top font-semibold text-[#344054]">{row.label}</td>
                  <td className="py-1.5 align-top text-[#1B1464]">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>,
        );
        continue;
      }
    }
    nodes.push(
      <p key={`p-${index}`} className="my-2 font-sans whitespace-pre-wrap">
        {line}
      </p>,
    );
    index += 1;
  }
  return <>{nodes}</>;
}

function PartiesSection({ parties }: { parties: FormalAgreementParty[] }) {
  const business = parties.find((party) => party.role === "business");
  const influencers = parties.filter((party) => party.role === "influencer");
  return (
    <Section heading="1. Parties">
      <dl className="space-y-2 font-sans text-[13px]">
        <div className="flex gap-2">
          <dt className="w-36 shrink-0 font-semibold">Business:</dt>
          <dd>{business?.legalName || "—"}</dd>
        </div>
        {influencers.map((party) => (
          <div key={party.legalName + (party.handle || "")} className="space-y-1">
            <div className="flex gap-2">
              <dt className="w-36 shrink-0 font-semibold">Influencer:</dt>
              <dd>{party.legalName}</dd>
            </div>
            {party.handle ? (
              <div className="flex gap-2">
                <dt className="w-36 shrink-0 font-semibold">Platform handle:</dt>
                <dd>{party.handle.startsWith("@") ? party.handle : `@${party.handle}`}</dd>
              </div>
            ) : null}
          </div>
        ))}
      </dl>
      <p className="mt-3 font-sans text-[12px] text-[#667085]">
        Influrios records this collaboration on the platform. It is not a contracting party to this business–influencer agreement.
      </p>
    </Section>
  );
}

function CompensationSection({
  compensation,
}: {
  compensation: FormalAgreementProps["compensation"];
}) {
  return (
    <Section heading="3. Compensation">
      <table className="w-full border-collapse font-sans text-[13px]">
        <tbody>
          <tr className="border-b border-[#E7ECF5]">
            <td className="py-2">Gross influencer compensation</td>
            <td className="py-2 text-right tabular-nums">{compensation.grossLabel}</td>
          </tr>
          <tr className="border-b border-[#E7ECF5]">
            <td className="py-2">Influencer fee</td>
            <td className="py-2 text-right tabular-nums">−{compensation.feeLabel.replace(/^-/, "")}</td>
          </tr>
          {compensation.taxLabel ? (
            <tr className="border-b border-[#E7ECF5]">
              <td className="py-2">Tax</td>
              <td className="py-2 text-right tabular-nums">{compensation.taxLabel}</td>
            </tr>
          ) : null}
          <tr className="bg-[#F4F6FB]">
            <td className="py-2 font-bold">Net compensation</td>
            <td className="py-2 text-right font-bold tabular-nums">{compensation.netLabel}</td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

function MilestoneSchedule({
  milestones,
  compensation,
  showFeeColumns,
}: {
  milestones: FormalAgreementMilestone[];
  compensation: FormalAgreementProps["compensation"];
  showFeeColumns: boolean;
}) {
  if (milestones.length === 0) return null;
  return (
    <section className="mt-10 break-inside-avoid">
      <h2 className="text-[22px] font-bold text-[#111A5A]">Schedule A · Milestones</h2>
      <table className="mt-4 w-full border-collapse font-sans text-[12px]">
        <thead>
          <tr className="border-b-2 border-[#1B1464] text-left text-[10px] font-bold uppercase tracking-wide text-[#1B1464]">
            <th className="py-2 pr-2">Milestone</th>
            <th className="py-2 pr-2">Share</th>
            <th className="py-2 pr-2 text-right">Gross amount</th>
            {showFeeColumns ? (
              <>
                <th className="py-2 pr-2 text-right">Influencer fee</th>
                <th className="py-2 text-right">Net compensation</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {milestones.map((row) => (
            <tr key={row.title + row.shareLabel} className="border-b border-[#E7ECF5]">
              <td className="py-2 pr-2">{row.title}</td>
              <td className="py-2 pr-2">{row.shareLabel}</td>
              <td className="py-2 pr-2 text-right tabular-nums">{row.grossLabel}</td>
              {showFeeColumns ? (
                <>
                  <td className="py-2 pr-2 text-right tabular-nums">{row.feeLabel || "—"}</td>
                  <td className="py-2 text-right tabular-nums">{row.netLabel || "—"}</td>
                </>
              ) : null}
            </tr>
          ))}
          <tr className="bg-[#F4F6FB] font-bold">
            <td className="py-2 pr-2">Total</td>
            <td className="py-2 pr-2">100%</td>
            <td className="py-2 pr-2 text-right tabular-nums">{compensation.grossLabel}</td>
            {showFeeColumns ? (
              <>
                <td className="py-2 pr-2 text-right tabular-nums">{compensation.feeLabel}</td>
                <td className="py-2 text-right tabular-nums">{compensation.netLabel}</td>
              </>
            ) : null}
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function ExecutionSection({ parties }: { parties: FormalAgreementParty[] }) {
  return (
    <Section heading="Execution">
      <div className="grid gap-8 font-sans sm:grid-cols-2">
        {parties.map((party) => (
          <div key={party.role + party.legalName} className="break-inside-avoid">
            <p className="font-bold text-[#1B1464]">
              {party.role === "business" ? `For ${party.legalName}` : party.legalName || "Influencer"}
            </p>
            {party.signed && party.signerName ? (
              <div className="mt-4 space-y-2 text-[13px]">
                <p className="text-[22px] italic text-[#111A5A]" style={{ fontFamily: "var(--font-caveat), Georgia, serif" }}>
                  {party.signerName}
                </p>
                <p>Printed name: {party.signerName}</p>
                <p>Capacity: {party.capacity || (party.role === "business" ? "Authorized representative" : "Influencer")}</p>
                <p>Date: {party.signedAtLabel || "—"}</p>
              </div>
            ) : (
              <div className="mt-4 space-y-4 text-[13px] text-[#667085]">
                <p>
                  Printed name: <span className="inline-block min-w-[12rem] border-b border-[#98A2B3]">&nbsp;</span>
                </p>
                <p>
                  Capacity: <span className="inline-block min-w-[12rem] border-b border-[#98A2B3]">&nbsp;</span>
                </p>
                <p>
                  Date: <span className="inline-block min-w-[12rem] border-b border-[#98A2B3]">&nbsp;</span>
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

function sectionKind(section: AgreementBodySection): "parties" | "compensation" | "milestones" | "other" {
  const heading = (section.heading ?? "").toLowerCase();
  if (/^1\.\s+parties/.test(heading)) return "parties";
  if (/^3\.\s+compensation/.test(heading)) return "compensation";
  if (/^4\.\s+milestone/.test(heading)) return "milestones";
  return "other";
}

export function FormalAgreementDocument({
  title,
  campaign,
  agreementRef,
  versionLabel,
  parties,
  body,
  compensation,
  milestones,
  showFeeColumns = true,
  draft = false,
  footerNote = "Agreement preview",
}: FormalAgreementProps) {
  const sections = parseAgreementBodySections(body);
  const kinds = new Set(sections.map((section) => sectionKind(section)));

  return (
    <article
      className="mx-auto max-w-[720px] border border-[#1B1464]/25 bg-white px-8 py-10 shadow-sm sm:px-10"
      style={{ fontFamily: 'Georgia, "Times New Roman", Times, serif' }}
    >
      <header className="border-b border-[#1B1464] pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3 text-[11px] uppercase tracking-wide text-[#667085]">
          <InfluriosWordmark className="inline-flex items-center gap-2 font-display text-lg font-bold normal-case tracking-normal text-indigo" />
          <span className="font-sans text-right">
            Agreement ID: {agreementRef}
            <br />
            Version: {versionLabel}
          </span>
        </div>
        <h1 className="mt-6 text-center text-[28px] font-bold leading-tight text-[#111A5A]">{title}</h1>
        <p className="mt-2 text-center text-[15px] italic text-[#344054]">{campaign}</p>
        {draft ? (
          <p className="mt-3 text-center font-sans text-xs font-semibold uppercase tracking-wide text-[#B86E00]">Draft — not executed</p>
        ) : null}
      </header>

      {!kinds.has("parties") ? <PartiesSection parties={parties} /> : null}

      {sections.map((section) => {
        const kind = sectionKind(section);
        if (kind === "parties") return <PartiesSection key={section.id} parties={parties} />;
        if (kind === "compensation") {
          return (
            <div key={section.id}>
              <CompensationSection compensation={compensation} />
              {!kinds.has("milestones") ? (
                <MilestoneSchedule milestones={milestones} compensation={compensation} showFeeColumns={showFeeColumns} />
              ) : null}
            </div>
          );
        }
        if (kind === "milestones") {
          return (
            <MilestoneSchedule
              key={section.id}
              milestones={milestones}
              compensation={compensation}
              showFeeColumns={showFeeColumns}
            />
          );
        }
        if (section.heading) {
          return (
            <Section key={section.id} heading={section.heading}>
              <BodyLines lines={section.lines} />
            </Section>
          );
        }
        return (
          <div key={section.id} className="mt-6">
            <BodyLines lines={section.lines} />
          </div>
        );
      })}

      {!kinds.has("compensation") ? (
        <>
          <CompensationSection compensation={compensation} />
          <MilestoneSchedule milestones={milestones} compensation={compensation} showFeeColumns={showFeeColumns} />
        </>
      ) : null}

      <ExecutionSection parties={parties} />

      <footer className="mt-10 flex items-center gap-3 border-t border-[#1B1464] pt-3 font-sans text-[11px] italic text-[#98A2B3]">
        <span className="h-px flex-1 bg-[#1B1464]/30" />
        {footerNote}
        <span className="h-px flex-1 bg-[#1B1464]/30" />
      </footer>
    </article>
  );
}
