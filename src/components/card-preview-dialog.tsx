"use client";

import Link from "next/link";
import { useState } from "react";
import { CopyTextButton } from "@/components/copy-text-button";

export function CardPreviewDialog({
  name,
  title,
  image,
  href,
  shareUrl,
}: {
  name: string;
  title: string;
  image: string | null;
  href: string;
  shareUrl: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex flex-1 items-center justify-center rounded-full bg-[#6D4AFF] px-3 py-2 text-sm font-semibold text-white"
      >
        View card
      </button>
      {shareUrl ? <CopyTextButton value={shareUrl} /> : null}
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="card-preview-title">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 id="card-preview-title" className="font-display text-lg font-bold text-indigo">
                Influencer Card
              </h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-lg leading-none text-muted">
                ×
              </button>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-[#E6ECF7]">
              <div className="flex h-40 items-center justify-center bg-[#F3EEFF]">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-display text-3xl font-bold text-violet">{name.slice(0, 1)}</span>
                )}
              </div>
              <div className="p-4">
                <p className="font-semibold text-indigo">{name}</p>
                {title ? <p className="text-sm text-muted">{title}</p> : null}
              </div>
            </div>
            <p className="mt-3 text-xs text-muted">This is a preview. Deliverables and discussion stay on the collaboration page.</p>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1 !py-2 text-sm">
                Close
              </button>
              <Link href={href} className="btn-primary flex-1 !py-2 text-center text-sm">
                Open full card
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
