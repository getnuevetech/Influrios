import Link from "next/link";
import type { ConfirmPartiesResult } from "@/lib/contract-party-confirm";
import { contractDocumentType } from "@/lib/contract-catalog";

export function ContractConfirmParties({
  documentTypeId,
  result,
  continueHref,
  backHref,
}: {
  documentTypeId: string;
  result: ConfirmPartiesResult;
  continueHref: string;
  backHref: string;
}) {
  const type = contractDocumentType(documentTypeId);
  return (
    <section className="rounded-[24px] border border-[#E7ECF5] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">Confirm parties</p>
      <h2 className="mt-1 font-display text-2xl font-bold text-[#1B1464]">{type.shortName}</h2>
      <p className="mt-2 text-sm text-[#667085]">
        The document names the party entering the agreement separately from the person who signs for that party.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <PartyCard
          title="Business"
          legalName={result.business.legalName || "Missing legal name"}
          signerName={result.business.signerName || "Missing authorized signer"}
          capacity={result.business.capacity}
          handle={result.business.tradingName}
          missing={result.business.missingFields}
        />
        <PartyCard
          title="Influencer"
          legalName={result.influencer.legalName || "Missing contracting name"}
          signerName={result.influencer.signerName || "Missing signer"}
          capacity={result.influencer.capacity}
          handle={result.influencer.handle ? `@${result.influencer.handle.replace(/^@/, "")}` : undefined}
          missing={result.influencer.missingFields}
        />
      </div>

      {result.blockers.length > 0 ? (
        <ul className="mt-4 space-y-2 rounded-2xl border border-[#F3D7A1] bg-[#FFF8EC] px-4 py-3 text-sm text-[#8A5A12]">
          {result.blockers.map((row) => (
            <li key={`${row.owner}-${row.field}`}>
              <span className="font-semibold">{row.owner === "business" ? "Business" : "Influencer"}:</span> {row.action}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl border border-[#C6EBD5] bg-[#E8F8EE] px-4 py-3 text-sm text-[#178A45]">
          Party identities are confirmed. They freeze when this draft is issued for signature.
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Link href={backHref} className="rounded-full border border-[#E7ECF5] px-4 py-2 text-sm font-semibold text-[#344054]">
          Back to templates
        </Link>
        {result.ok ? (
          <Link href={continueHref} className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">
            Continue to draft
          </Link>
        ) : (
          <span className="rounded-full bg-[#E7ECF5] px-4 py-2 text-sm font-semibold text-[#98A2B3]">Continue to draft</span>
        )}
      </div>
    </section>
  );
}

function PartyCard({
  title,
  legalName,
  signerName,
  capacity,
  handle,
  missing,
}: {
  title: string;
  legalName: string;
  signerName: string;
  capacity: string;
  handle?: string;
  missing: string[];
}) {
  return (
    <div className="rounded-2xl border border-[#E7ECF5] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#98A2B3]">{title}</p>
      <p className="mt-2 font-display text-lg font-bold text-[#1B1464]">{legalName}</p>
      {handle ? <p className="mt-1 text-sm text-[#667085]">{handle}</p> : null}
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-[#98A2B3]">Authorized signer</dt>
          <dd className="font-semibold text-[#1B1464]">{signerName}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[#98A2B3]">Capacity</dt>
          <dd className="font-semibold text-[#1B1464]">{capacity || "—"}</dd>
        </div>
      </dl>
      {missing.length > 0 ? (
        <p className="mt-3 text-xs font-semibold text-[#B86E00]">Complete details required before sending</p>
      ) : null}
    </div>
  );
}
