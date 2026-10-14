import Link from "next/link";
import {
  actionAddKycRequirement,
  actionAdminSetCreatorKyc,
  actionRemoveKycRequirement,
  actionReviewDocumentKyc,
  actionSaveKycGateway,
} from "@/app/admin/kyc/actions";
import { requireAdminPage } from "@/app/admin/guard";
import { AdminCollapse } from "@/components/admin-collapse";
import { hasPermission } from "@/lib/admin-auth";
import { kycDetailsRecord, listKycRequirements, loadKycSettings } from "@/lib/kyc-document";
import { prisma } from "@/lib/db";
import { listProviders } from "@/lib/providers";

export const dynamic = "force-dynamic";
export const metadata = { title: "KYC · Admin" };

const selectClass = "mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo";

type Props = { searchParams: Promise<{ saved?: string; error?: string }> };

export default async function AdminKycPage({ searchParams }: Props) {
  const session = await requireAdminPage("collab_finance");
  const canManage = hasPermission(session, "collab_finance.manage");
  const params = await searchParams;
  const [settings, requirements, providers, submissions, creators] = await Promise.all([
    loadKycSettings().catch(() => null),
    listKycRequirements().catch(() => []),
    listProviders("payment").catch(() => []),
    prisma.creatorKycSubmission
      .findMany({ orderBy: { updatedAt: "desc" }, include: { documents: true }, take: 50 })
      .catch(() => []),
    prisma.creator
      .findMany({
        orderBy: { slug: "asc" },
        select: { slug: true, displayName: true, identityVerified: true },
        take: 200,
      })
      .catch(() => []),
  ]);
  const gatewayId = settings?.gatewayProviderId ?? "";
  const gateway = providers.find((provider) => provider.id === gatewayId);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <Link href="/admin" className="text-sm font-semibold text-violet hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold text-indigo">KYC</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          Countries set to KYC by Gateway use the gateway selected here. Countries set to KYC by Document Upload use
          the details and documents defined here. Choose the country type on{" "}
          <Link href="/admin/corridors" className="font-semibold text-violet hover:underline">
            Country corridors
          </Link>
          . Approving KYC here sets the creator account to verified so payout readiness can clear.
        </p>
      </div>

      {params.saved ? <p className="text-sm font-semibold text-emerald-700">Saved ({params.saved}).</p> : null}
      {params.error ? <p className="text-sm font-semibold text-amber-800">{params.error}</p> : null}

      <AdminCollapse title="KYC by Gateway" subtitle={gateway?.name ?? "No KYC gateway selected"} defaultOpen>
        <p className="max-w-3xl text-sm text-muted">
          The creator completes KYC with this payment gateway. The United States can use Stripe Identity. Completed
          sessions update the creator account as verified for payouts.
        </p>
        {canManage ? (
          <form action={actionSaveKycGateway} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-muted">
              Gateway used for KYC
              <select name="gatewayProviderId" required defaultValue={gatewayId} className={selectClass}>
                <option value="" disabled>
                  Choose a gateway
                </option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-primary !px-4 !py-2 text-xs">
              Save KYC gateway
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm font-semibold text-indigo">{gateway?.name ?? "No KYC gateway selected."}</p>
        )}
      </AdminCollapse>

      <AdminCollapse
        title="KYC by Document Upload"
        subtitle={`${requirements.length} requirement${requirements.length === 1 ? "" : "s"}`}
      >
        <p className="max-w-3xl text-sm text-muted">
          Add each detail and each document the creator must provide. A document-upload country shows this list on
          Identity KYC.
        </p>
        {requirements.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No details or documents have been added.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {requirements.map((requirement) => (
              <li key={requirement.id} className="flex flex-wrap items-center justify-between gap-3 text-sm text-indigo">
                <span>
                  {requirement.kind === "document" ? "Document" : "Detail"} · {requirement.label}
                  {requirement.required ? "" : " · optional"}
                </span>
                {canManage ? (
                  <form action={actionRemoveKycRequirement}>
                    <input type="hidden" name="id" value={requirement.id} />
                    <button type="submit" className="text-xs font-semibold text-amber-800 hover:underline">
                      Remove
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canManage ? (
          <form action={actionAddKycRequirement} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted">
              Kind
              <select name="kind" required defaultValue="detail" className={selectClass}>
                <option value="detail">Detail</option>
                <option value="document">Document</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">
              Name
              <input
                name="label"
                required
                placeholder="Date of birth"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm text-indigo"
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-indigo">
              <input type="checkbox" name="required" value="1" defaultChecked />
              Required
            </label>
            <div>
              <button type="submit" className="btn-primary !px-4 !py-2 text-xs">
                Add requirement
              </button>
            </div>
          </form>
        ) : null}
      </AdminCollapse>

      <AdminCollapse
        title="Manual account KYC"
        subtitle="Set Creator.identityVerified for payouts without a submission"
        defaultOpen
      >
        <p className="max-w-3xl text-sm text-muted">
          Use this when document or gateway KYC is complete offline, or to unblock payouts after verifying identity
          outside Influrios. Verified status is what payout readiness checks.
        </p>
        {canManage ? (
          <form action={actionAdminSetCreatorKyc} className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-muted">
              Creator
              <select name="creatorSlug" required defaultValue="" className={selectClass}>
                <option value="" disabled>
                  Choose a creator
                </option>
                {creators.map((creator) => (
                  <option key={creator.slug} value={creator.slug}>
                    {creator.displayName || creator.slug} · {creator.identityVerified}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-muted">
              Decision
              <select name="decision" required defaultValue="verified" className={selectClass}>
                <option value="verified">Mark KYC completed / verified</option>
                <option value="rejected">Mark rejected</option>
              </select>
            </label>
            <button type="submit" className="btn-primary !px-4 !py-2 text-xs">
              Update account KYC
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted">You can view KYC but not change account verification.</p>
        )}
      </AdminCollapse>

      <AdminCollapse title="Submissions" subtitle={`${submissions.length} recent`} defaultOpen>
        {submissions.length === 0 ? (
          <p className="text-sm text-muted">No KYC submissions yet.</p>
        ) : (
          <ul className="space-y-3">
            {submissions.map((submission) => {
              const details = kycDetailsRecord(submission.detailsJson);
              const pending =
                submission.status === "submitted" ||
                submission.status === "pending_gateway" ||
                submission.status === "PENDING";
              return (
                <li key={submission.id}>
                  <AdminCollapse
                    title={`${submission.creatorSlug} · ${submission.status}`}
                    subtitle={`${submission.countryCode || "no country"} · ${
                      submission.kycModel === "government_id" ? "Document upload" : "Gateway"
                    }`}
                  >
                    {Object.keys(details).length > 0 ? (
                      <ul className="space-y-1 text-xs text-indigo">
                        {Object.entries(details).map(([key, value]) => (
                          <li key={key}>{value}</li>
                        ))}
                      </ul>
                    ) : null}
                    {submission.documents.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs">
                        {submission.documents.map((document) => (
                          <li key={document.id}>
                            <a
                              href={`/admin/kyc/file/${document.id}`}
                              className="font-semibold text-violet hover:underline"
                            >
                              {document.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {canManage && pending ? (
                      <div className="mt-3 flex gap-2">
                        <form action={actionReviewDocumentKyc}>
                          <input type="hidden" name="submissionId" value={submission.id} />
                          <input type="hidden" name="decision" value="verified" />
                          <button type="submit" className="btn-primary !px-3 !py-1.5 text-xs">
                            Mark verified
                          </button>
                        </form>
                        <form action={actionReviewDocumentKyc}>
                          <input type="hidden" name="submissionId" value={submission.id} />
                          <input type="hidden" name="decision" value="rejected" />
                          <button type="submit" className="btn-secondary !px-3 !py-1.5 text-xs">
                            Reject
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </AdminCollapse>
                </li>
              );
            })}
          </ul>
        )}
      </AdminCollapse>
    </div>
  );
}
