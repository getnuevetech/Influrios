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
  let draft: Awaited<ReturnType<typeof getCreatorSessionDraft>> = null;
  let params: { saved?: string; error?: string } = {};
  try {
    draft = await getCreatorSessionDraft();
    params = await searchParams;
  } catch (error) {
    console.error("dashboard/kyc session", error);
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <h1 className="font-display text-2xl font-bold text-indigo">Identity KYC</h1>
        <p className="text-sm text-amber-800">Could not load your session. Sign in again, then reopen Identity KYC.</p>
        <Link href="/login?next=/dashboard/kyc" className="text-sm font-semibold text-violet hover:underline">
          Sign in
        </Link>
      </div>
    );
  }
  if (!draft) redirect("/claim");

  const countryCode = countryCodeFromLocation(draft.locationCountry) ?? "";
  let country = null as ReturnType<typeof corridorCountryByCode>;
  let corridor = null as { kycModel: string } | null;
  let requirements = [] as Awaited<ReturnType<typeof listKycRequirements>>;
  let settings = null as Awaited<ReturnType<typeof loadKycSettings>>;
  let submission = null as {
    kycModel: string;
    status: string;
    detailsJson: unknown;
    gatewaySessionUrl: string;
    documents: { requirementId: string }[];
  } | null;
  let creator = null as { id: string } | null;
  let gateway = null as { name: string; enabled: boolean } | null;
  let loadError: string | null = null;

  try {
    country = corridorCountryByCode(countryCode);
    const loaded = await Promise.all([
      countryCode
        ? prisma.countryActivationCorridor.findUnique({ where: { countryCode } }).catch(() => null)
        : Promise.resolve(null),
      listKycRequirements().catch(() => [] as Awaited<ReturnType<typeof listKycRequirements>>),
      loadKycSettings().catch(() => null),
      prisma.creatorKycSubmission
        .findUnique({ where: { creatorSlug: draft.slug }, include: { documents: true } })
        .catch(() => null),
      prisma.creator.findUnique({ where: { slug: draft.slug }, select: { id: true } }).catch(() => null),
    ]);
    corridor = loaded[0];
    requirements = loaded[1] ?? [];
    settings = loaded[2];
    submission = loaded[3]
      ? {
          kycModel: loaded[3].kycModel,
          status: loaded[3].status,
          detailsJson: loaded[3].detailsJson,
          gatewaySessionUrl: loaded[3].gatewaySessionUrl,
          documents: loaded[3].documents ?? [],
        }
      : null;
    creator = loaded[4];
    gateway = settings?.gatewayProviderId
      ? await prisma.integrationProvider
          .findFirst({
            where: { id: settings.gatewayProviderId, kind: "payment" },
            select: { name: true, enabled: true },
          })
          .catch(() => null)
      : null;
  } catch (error) {
    console.error("dashboard/kyc load", error);
    loadError = error instanceof Error ? error.message : "Could not load KYC.";
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        <Link href="/dashboard" className="text-sm font-semibold text-violet hover:underline">
          ← Dashboard
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-indigo">Identity KYC</h1>
        <p className="text-sm text-amber-800">{loadError}</p>
      </div>
    );
  }

  const kyc = kycTypeByCode(corridor?.kycModel);
  const details = kycDetailsRecord(submission?.detailsJson);
  const identityUrl = storedIdentitySessionUrl(submission?.gatewaySessionUrl);
  const uploaded = new Set(
    submission?.kycModel === "government_id" ? (submission.documents ?? []).map((document) => document.requirementId) : [],
  );

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
          <p className="mt-2 text-xs text-muted">Each file must be JPG, PNG, WEBP, or PDF and 8 MB or smaller.</p>
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
            <form action={actionSubmitDocumentKyc} encType="multipart/form-data" className="mt-4 space-y-3">
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
