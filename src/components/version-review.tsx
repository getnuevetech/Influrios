"use client";

import Link from "next/link";
import { useState } from "react";
import { actionRequestRevision } from "@/app/payments/actions";
import { currentSubmittedVersion } from "@/lib/version-review";

type VersionFile = { id: string; fileName: string };
type VersionRow = {
  id: string;
  version: number;
  status: string;
  note: string;
  linkUrl: string;
  reviewNote: string;
  creatorSlug: string;
  files: VersionFile[];
};

export function VersionReview({
  dealId,
  milestoneId,
  business,
  versions,
  revisionCount,
  revisionLimit,
  reviewBy,
  initialVersion,
}: {
  dealId: string;
  milestoneId: string;
  business: boolean;
  versions: VersionRow[];
  revisionCount: number;
  revisionLimit: number;
  reviewBy: string | null;
  initialVersion?: number;
}) {
  const latest = versions.reduce((highest, row) => (row.version > highest ? row.version : highest), 0);
  const opening = versions.some((row) => row.version === initialVersion) ? initialVersion ?? latest : latest;
  const [selectedVersion, setSelectedVersion] = useState(opening);
  const selected = versions.find((row) => row.version === selectedVersion) ?? versions[versions.length - 1] ?? null;
  const current = currentSubmittedVersion(versions);
  const canAct = Boolean(business && selected && current && selected.version === current.version);

  if (!selected) return <p className="mt-4 text-sm text-[#667085]">No submission yet.</p>;

  return (
    <div className="mt-4 space-y-3">
      <label className="block text-xs font-semibold text-[#667085]">
        Version
        <select
          value={selected.version}
          onChange={(event) => setSelectedVersion(Number(event.target.value))}
          className="mt-1 w-full rounded-xl border border-[#E4E9F5] px-3 py-2 text-sm text-[#1B1464]"
        >
          {versions.map((row) => (
            <option key={row.id} value={row.version}>
              Version {row.version} · {row.status.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <div className="rounded-xl border border-[#E4EBFF] px-3 py-3 text-sm">
        <p className="font-semibold text-[#1B1464]">
          Version {selected.version} · {selected.creatorSlug}
        </p>
        <p className="mt-1 text-xs text-[#667085]">
          Revisions {revisionCount}
          {revisionLimit > 0 ? ` of ${revisionLimit}` : ""}
          {reviewBy ? ` · review by ${reviewBy}` : ""}
        </p>
        {selected.note ? <p className="mt-2 text-[#344054]">{selected.note}</p> : null}
        {selected.linkUrl ? (
          <a href={selected.linkUrl} className="mt-2 block font-semibold text-[#6D4AFF] hover:underline">
            {selected.linkUrl}
          </a>
        ) : null}
        {selected.reviewNote ? <p className="mt-2 text-amber-900">Review: {selected.reviewNote}</p> : null}
        {selected.files.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {selected.files.map((file) => (
              <li key={file.id}>
                <a href={`/api/deliverables/${file.id}`} className="font-semibold text-[#6D4AFF] hover:underline">
                  {file.fileName}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {canAct ? (
        <div className="space-y-3">
          <Link
            href={`/collaboration/work/${dealId}?release=${milestoneId}&version=${selected.version}`}
            className="inline-flex h-11 items-center rounded-full bg-[#6D4AFF] px-4 text-sm font-semibold text-white"
          >
            Review submission
          </Link>
          <form action={actionRequestRevision} className="space-y-2">
            <input type="hidden" name="dealId" value={dealId} />
            <input type="hidden" name="milestoneId" value={milestoneId} />
            <input type="hidden" name="versionNumber" value={selected.version} />
            <textarea name="note" required minLength={8} rows={2} placeholder="What should change" className="w-full rounded-xl border border-[#E4E9F5] px-3 py-2 text-sm" />
            <button type="submit" className="rounded-full border border-[#E4E9F5] px-4 py-2 text-sm font-semibold text-[#1B1464]">
              Request revision
            </button>
          </form>
          <p className="text-xs text-[#98A2B3]">Approving this version does not confirm the payout.</p>
        </div>
      ) : business && current && selected.version !== current.version ? (
        <p className="text-xs text-[#667085]">This version stays on the record. Review the latest submitted version to approve it or request a revision.</p>
      ) : null}
    </div>
  );
}
