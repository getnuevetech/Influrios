"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource react */
import { useActionState, useState } from "react";
import type { WorkroomActionResult } from "@/app/payments/actions";
import { DeliverableFileField, useDeliverableFiles } from "@/components/deliverable-file-field";

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
  const { files, readyFiles, hasBlocking, addFiles, replaceFile, removeFile } = useDeliverableFiles();
  const [clientError, setClientError] = useState<string | null>(initialError);
  const [state, formAction, pending] = useActionState(
    async (_prev: WorkroomActionResult | null, formData: FormData) => action(formData),
    null,
  );
  const error = clientError || state?.error || null;
  const showRetryUpload = state?.errorKind === "upload";

  return (
    <form
      data-keep-scroll
      className="mt-4 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (readyFiles.length === 0) {
          setClientError("Choose a document, media file, or zip.");
          return;
        }
        if (hasBlocking) {
          setClientError("Replace or remove files that are unsupported or too large before uploading.");
          return;
        }
        setClientError(null);
        const data = new FormData();
        data.set("dealId", dealId);
        data.set("milestoneId", milestoneId);
        data.set("tab", tab);
        data.set("intent", "details");
        for (const file of readyFiles) data.append("files", file);
        formAction(data);
      }}
    >
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
