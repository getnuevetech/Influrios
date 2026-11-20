"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource react */
import { startTransition, useActionState, useState, type FormEvent } from "react";
import { DeliverableFileField, useDeliverableFiles } from "@/components/deliverable-file-field";
import type { WorkroomActionResult } from "@/lib/workroom-action";

type FilesAction = (formData: FormData) => Promise<WorkroomActionResult>;

export function DeliverableAddFilesForm({
  dealId,
  milestoneId,
  tab,
  action,
  initialError = null,
}: {
  dealId: string;
  milestoneId: string;
  tab: string;
  action: FilesAction;
  initialError?: string | null;
}) {
  const { files, readyFiles, hasBlocking, limitError, addFiles, replaceFile, removeFile } = useDeliverableFiles();
  const [clientError, setClientError] = useState<string | null>(initialError);
  const [state, formAction, pending] = useActionState(
    async (_prev: WorkroomActionResult | null, formData: FormData) => action(formData),
    null,
  );
  const error = clientError || limitError || state?.error || null;
  const showRetryUpload = state?.errorKind === "upload";

  function dispatchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (readyFiles.length === 0) {
      setClientError("Choose a document, media file, or zip.");
      return;
    }
    if (hasBlocking) {
      setClientError("Replace or remove files that are unsupported or too large before uploading.");
      return;
    }
    if (limitError) {
      setClientError(limitError);
      return;
    }
    setClientError(null);
    const data = new FormData();
    data.set("dealId", dealId);
    data.set("milestoneId", milestoneId);
    data.set("tab", tab);
    data.set("intent", "details");
    for (const file of readyFiles) data.append("files", file);
    startTransition(() => {
      formAction(data);
    });
  }

  return (
    <form action={formAction} data-keep-scroll className="mt-4 space-y-3" onSubmit={dispatchSubmit}>
      {error ? (
        <div role="alert" className="rounded-2xl bg-[#FFF8F7] px-3 py-3 text-sm font-semibold text-[#B42318]">
          {error}
        </div>
      ) : null}
      <DeliverableFileField
        label="Add files"
        files={files}
        onAdd={addFiles}
        onReplace={replaceFile}
        onRemove={removeFile}
        disabled={pending}
        uploading={pending}
        limitError={limitError}
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center rounded-full border border-[#E4E9F5] px-4 text-sm font-semibold text-[#1B1464] disabled:opacity-60"
      >
        {pending ? "Uploading…" : showRetryUpload ? "Retry upload" : "Add files"}
      </button>
    </form>
  );
}
