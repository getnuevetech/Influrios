"use client";

import Link from "next/link";
import { useState } from "react";
import { AccountDialog } from "@/components/account-dialog";
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
        <AccountDialog title="Influencer Card" onClose={() => setOpen(false)}>
          <div className="overflow-hidden rounded-2xl border border-[#E6ECF7]">
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
          <div className="mt-4">
            <Link href={href} className="btn-primary inline-flex !py-2 text-sm">
              Open full card
            </Link>
          </div>
        </AccountDialog>
      ) : null}
    </>
  );
}
