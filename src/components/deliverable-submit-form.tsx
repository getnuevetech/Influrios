"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource react */
import { useActionState, useEffect, useState, type FormEvent } from "react";
import type { WorkroomActionResult } from "@/app/payments/actions";
import { DeliverableFileField, useDeliverableFiles } from "@/components/deliverable-file-field";
import { deliverableLinkPreview, submissionIsComplete } from "@/lib/milestone-delivery";

type SubmitAction = (formData: FormData) => Promise<WorkroomActionResult>;

export function DeliverableSubmitForm({
  dealId,
  milestoneId,
  tab,
  intent = "submit",
  submitLabel,
  closeHref,
  paymentsHref = "/payments",
  action,
  draftNote = "",
  draftLink = "",
  initialError = null,
}: {
  dealId: string;
  milestoneId: string;
  tab: string;
  intent?: string;
  submitLabel: string;
  closeHref: string;
  paymentsHref?: string;
  action: SubmitAction;
  draftNote?: string;
  draftLink?: string;
  initialError?: string | null;
}) {
  const [note, setNote] = useState(draftNote);
  const [linkUrl, setLinkUrl] = useState(draftLink);
  const [clientError, setClientError] = useState<string | null>(initialError);
  const { files, readyFiles, hasBlocking, addFiles, replaceFile, removeFile } = useDeliverableFiles();
  const [state, formAction, pending] = useActionState(
    async (_prev: WorkroomActionResult | null, formData: FormData) => action(formData),
    null,
  );
  const preview = deliverableLinkPreview(linkUrl);
  const error = clientError || state?.error || null;
  const errorKind = state?.errorKind;
  const showRetryUpload = errorKind === "upload";
  const fieldError = Boolean(error);

  useEffect(() => {
    if (state?.error) setClientError(null);
  }, [state]);

  function buildFormData() {
    const data = new FormData();
    data.set("dealId", dealId);
    data.set("milestoneId", milestoneId);
    data.set("tab", tab);
    data.set("intent", intent);
    data.set("note", note);
    data.set("linkUrl", linkUrl);
    for (const file of readyFiles) data.append("files", file);
    return data;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (hasBlocking) {
      event.preventDefault();
      setClientError("Replace or remove files that are unsupported or too large before submitting.");
      return;
    }
    const complete = submissionIsComplete({ note, linkUrl, fileCount: readyFiles.length });
    if (!complete.ok) {
      event.preventDefault();
      setClientError(complete.error);
      return;
    }
    setClientError(null);
  }

  return (
    <form
      action={formAction}
      data-keep-scroll
      className="mt-4 space-y-3"
      onSubmit={(event) => {
        onSubmit(event);
        if (event.defaultPrevented) return;
        // Rebuild file parts from React state (native input is uncontrolled/empty after select).
        event.preventDefault();
        formAction(buildFormData());
      }}
    >
      {error ? (
        <div
          role="alert"
          className={`rounded-2xl px-3 py-3 text-sm font-semibold ${
            errorKind === "file" || errorKind === "upload" ? "bg-[#FFF8F7] text-[#B42318]" : "bg-[#FFF7E8] text-[#B54708]"
          }`}
        >
          {error}
        </div>
      ) : null}
      <label className="block text-sm font-semibold text-[#1B1464]">
        Deliverable link
        <input
          name="linkUrl"
          value={linkUrl}
          onChange={(event) => setLinkUrl(event.target.value)}
          placeholder="https:// or paste a domain"
          className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm font-normal ${
            fieldError && preview?.kind === "error" ? "border-[#F4A3A0] bg-[#FFF8F7]" : "border-[#E4E9F5]"
          }`}
        />
      </label>
      {preview?.kind === "will-save" ? (
        <p className="rounded-xl bg-[#EEF4FF] px-3 py-2 text-xs font-semibold text-[#1D4ED8]">{preview.text}</p>
      ) : null}
      {preview?.kind === "error" ? (
        <p className="rounded-xl bg-[#FFF8F7] px-3 py-2 text-xs font-semibold text-[#B42318]">{preview.text}</p>
      ) : null}
      <label className="block text-sm font-semibold text-[#1B1464]">
        What changed?
        <textarea
          name="note"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Describe the updates in this version..."
          className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm font-normal ${
            fieldError ? "border-[#F4A3A0] bg-[#FFF8F7]" : "border-[#E4E9F5]"
          }`}
        />
      </label>
      <DeliverableFileField
        files={files}
        onAdd={addFiles}
        onReplace={replaceFile}
        onRemove={removeFile}
        disabled={pending}
        uploading={pending}
      />
      <p className="text-xs text-[#667085]">Submitting starts the review window.</p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <a
          href={closeHref}
          data-keep-scroll
          className="inline-flex h-11 items-center rounded-full border border-[#E4E9F5] px-4 text-sm font-semibold text-[#1B1464]"
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center rounded-full bg-[#6D4AFF] px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : showRetryUpload ? "Retry upload" : error ? "Retry" : submitLabel}
        </button>
        <a href={paymentsHref} className="ml-auto text-xs font-semibold text-[#667085] hover:text-[#6D4AFF]">
          View collaboration payments
        </a>
      </div>
    </form>
  );
}
