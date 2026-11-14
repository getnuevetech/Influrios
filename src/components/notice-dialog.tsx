"use client";

import Link from "next/link";
import { AccountDialog } from "@/components/account-dialog";

/** Opening this notice marks it read. The underlying task stays open. */
export function NoticeDialog({
  title,
  detail,
  note,
  closeHref,
  destination,
}: {
  title: string;
  detail: string;
  note?: string | null;
  closeHref: string;
  destination: string;
}) {
  return (
    <AccountDialog title={title} closeHref={closeHref}>
      <p className="text-sm text-[#344054]">{detail}</p>
      <p className="mt-3 text-xs text-[#667085]">
        This notice is now read. The invitation, signature, or payment task stays open until you finish it.
      </p>
      {note ? <p className="mt-2 text-xs text-[#667085]">{note}</p> : null}
      <div className="mt-5 flex justify-end gap-2">
        <Link href={closeHref} className="rounded-full border border-[#E4E9F5] px-4 py-2 text-sm font-semibold text-[#344054]">
          Close
        </Link>
        <Link href={destination} className="rounded-full bg-[#6D4AFF] px-4 py-2 text-sm font-semibold text-white">
          Open
        </Link>
      </div>
    </AccountDialog>
  );
}
