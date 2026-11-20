"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource react */
import { useActionState, useState } from "react";
import type { WorkroomActionResult } from "@/lib/workroom-action";

type ReviseAction = (formData: FormData) => Promise<WorkroomActionResult>;

export function DeliverableReviseForm({
  dealId,
  milestoneId,
  tab,
  reviewVersion,
  hubHref,
  action,
  draftNote = "",
  initialError = null,
}: {
  dealId: string;
  milestoneId: string;
  tab: string;
  reviewVersion: number;
  hubHref: string;
  action: ReviseAction;
  draftNote?: string;
  initialError?: string | null;
}) {
  const [note, setNote] = useState(draftNote);
  const [clientError, setClientError] = useState<string | null>(initialError);
  const [state, formAction, pending] = useActionState(
    async (_prev: WorkroomActionResult | null, formData: FormData) => action(formData),
    null,
  );
  const error = clientError || state?.error || null;

  return (
    <form action={formAction} data-keep-scroll className="mt-4 space-y-3">
      <input type="hidden" name="dealId" value={dealId} />
      <input type="hidden" name="milestoneId" value={milestoneId} />
      <input type="hidden" name="versionNumber" value={reviewVersion} />
      <input type="hidden" name="tab" value={tab} />
      <input type="hidden" name="intent" value="review" />
      <input type="hidden" name="review" value="changes" />
      {error ? (
        <div role="alert" className="rounded-2xl bg-[#FFF7E8] px-3 py-3 text-sm font-semibold text-[#B54708]">
          {error}
        </div>
      ) : null}
      <label className="block text-sm font-semibold text-[#1B1464]">
        What should change <span className="text-[#B42318]">*</span>
        <textarea
          name="note"
          required
          minLength={8}
          rows={3}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setClientError(null);
          }}
          placeholder="Required feedback for the influencer"
          className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm font-normal ${
            error ? "border-[#F4A3A0] bg-[#FFF8F7]" : "border-[#E4E9F5]"
          }`}
        />
      </label>
      <p className="text-xs text-[#667085]">Approve is not available on this step. Clear feedback or go back to choose Approve.</p>
      <div className="flex flex-wrap gap-2">
        <a
          href={hubHref}
          data-keep-scroll
          className="inline-flex h-11 items-center rounded-full border border-[#E4E9F5] px-4 text-sm font-semibold text-[#1B1464]"
        >
          Back
        </a>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center rounded-full bg-[#6D4AFF] px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Sending…" : error ? "Retry" : "Send change request"}
        </button>
      </div>
    </form>
  );
}
