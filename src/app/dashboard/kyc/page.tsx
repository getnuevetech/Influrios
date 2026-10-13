import Link from "next/link";
import { actionStartGatewayKyc, actionSubmitDocumentKyc } from "@/app/dashboard/kyc/actions";
import { getCreatorSessionDraft } from "@/lib/claim";
import { countryCodeFromLocation } from "@/lib/contract-wizard";
import { corridorCountryByCode } from "@/lib/corridor-countries";
import { prisma } from "@/lib/db";
import { storedIdentitySessionUrl } from "@/lib/corridor-checkout";
import { kycDetailsRecord, listKycRequirements, loadKycSettings } from "@/lib/kyc-document";
import { kycTypeByCode } from "@/lib/kyc-types";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Identity KYC" };

const inputClass = "mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo";

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function DashboardKycPage({ searchParams }: Props) {
  const draft = await getCreatorSessionDraft();
  if (!draft) redirect("/claim");
  const params = await searchParams;
  const countryCode = countryCodeFromLocation(draft.locationCountry) ?? "";
  const country = corridorCountryByCode(countryCode);
  const [corridor, requirements, settings, submission, creator] = await Promise.all([
    countryCode
      ? prisma.countryActivationCorridor.findUnique({ where: { countryCode } }).catch(() => null)
      : Promise.resolve(null),
    listKycRequirements().catch(() => []),
    loadKycSettings().catch(() => null),
    prisma.creatorKycSubmission
      .findUnique({ where: { creatorSlug: draft.slug }, include: { documents: true } })
      .catch(() => null),
    prisma.creator.findUnique({ where: { slug: draft.slug } }).catch(() => null),
  ]);
  const kyc = kycTypeByCode(corridor?.kycModel);
  const gateway = settings?.gatewayProviderId
    ? await prisma.integrationProvider
        .findFirst({ where: { id: settings.gatewayProviderId, kind: "payment" } })
        .catch(() => null)
    : null;
  const details = kycDetailsRecord(submission?.detailsJson);
  const identityUrl = storedIdentitySessionUrl(submission?.gatewaySessionUrl);
  const uploaded = new Set(submission?.kycModel === "government_id" ? submission.documents.map((document) => document.requirementId) : []);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div>
        <Link href="/dashboard" className="text-sm font-semibold text-violet hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Identity KYC</h1>
        <p className="mt-2 text-sm text-muted">
          {country ? `${country.name} uses the KYC type saved on that country corridor.` : "Set your country on your profile before submitting KYC."}
        </p>
      </div>
      {params.saved ? <p className="text-sm font-semibold text-emerald-700">Saved ({params.saved}).</p> : null}
      {params.error ? <p className="text-sm font-semibold text-amber-800">{params.error}</p> : null}

      {!kyc ? (
        <p className="text-sm text-muted">This country does not have a KYC type yet.</p>
      ) : kyc.code === "gateway" ? (
        <article className="rounded-2xl border border-[#E4EBFF] bg-white p-4">
          <h2 className="font-display text-lg font-bold text-indigo">{kyc.label}</h2>
          {gateway?.enabled ? (
            <>
              <p className="mt-2 text-sm text-muted">
                Your KYC is completed with {gateway.name}. Identity stays unverified until {gateway.name} reports KYC
                complete.
              </p>
              {submission?.status === "pending_gateway" ? (
                <div className="mt-3 space-y-2">
                  <p className="text-sm font-semibold text-indigo">Waiting on {gateway.name}.</p>
                  {identityUrl ? (
                    <a href={identityUrl} className="text-sm font-semibold text-violet hover:underline">
                      Continue identity check
                    </a>
                  ) : null}
                </div>
              ) : (
                <form action={actionStartGatewayKyc} className="mt-4">
                  <button type="submit" className="btn-primary !px-4 !py-2 text-sm">
                    Continue with {gateway.name}
                  </button>
                </form>
              )}
            </>
          ) : gateway ? (
            <p className="mt-2 text-sm text-muted">That KYC gateway is not enabled. No identity session was opened.</p>
          ) : (
            <p className="mt-2 text-sm text-muted">A KYC gateway has not been selected.</p>
          )}
        </article>
      ) : kyc.code === "government_id" ? (
        <article className="rounded-2xl border border-[#E4EBFF] bg-white p-4">
          <h2 className="font-display text-lg font-bold text-indigo">{kyc.label}</h2>
          <p className="mt-2 text-sm text-muted">
            Enter the details and upload the documents configured for this KYC type.
            {submission?.status === "verified"
              ? " This submission is verified."
              : submission?.status === "rejected"
                ? " The last submission was rejected. Submit it again."
                : submission?.status === "submitted"
                  ? " This submission is waiting for review."
                  : ""}
          </p>
          {creator ? null : (
            <p className="mt-2 text-xs text-muted">Your directory profile is created when the card is published.</p>
          )}
          {requirements.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Document KYC has no required details or documents yet.</p>
          ) : submission?.status === "verified" ? (
            <ul className="mt-3 space-y-1 text-sm text-indigo">
              {requirements.map((requirement) => (
                <li key={requirement.id}>
                  {requirement.label}
                  {requirement.kind === "detail" ? `: ${details[requirement.id] ?? ""}` : uploaded.has(requirement.id) ? " uploaded" : ""}
                </li>
              ))}
            </ul>
          ) : (
            <form action={actionSubmitDocumentKyc} className="mt-4 space-y-3">
              {requirements.map((requirement) =>
                requirement.kind === "detail" ? (
                  <label key={requirement.id} className="block text-xs font-semibold text-muted">
                    {requirement.label}
                    {requirement.required ? "" : " (optional)"}
                    <input
                      name={`detail:${requirement.id}`}
                      defaultValue={details[requirement.id] ?? ""}
                      required={requirement.required}
                      className={inputClass}
                    />
                  </label>
                ) : (
                  <label key={requirement.id} className="block text-xs font-semibold text-muted">
                    {requirement.label}
                    {requirement.required ? "" : " (optional)"}
                    {uploaded.has(requirement.id) ? " · already uploaded" : ""}
                    <input
                      type="file"
                      name={`document:${requirement.id}`}
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      required={requirement.required && !uploaded.has(requirement.id)}
                      className={inputClass}
                    />
                  </label>
                ),
              )}
              <button type="submit" className="btn-primary !px-4 !py-2 text-sm">
                Submit KYC
              </button>
            </form>
          )}
        </article>
      ) : null}
    </div>
  );
}
