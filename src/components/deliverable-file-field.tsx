"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource react */
import { useId, useRef, useState } from "react";
import {
  DELIVERABLE_ACCEPT,
  DELIVERABLE_FILE_LIMIT,
  classifyDeliverableFile,
  formatDeliverableBytes,
  type DeliverableFileIssue,
} from "@/lib/deliverable-file-rules";

export type PendingDeliverableFile = {
  key: string;
  file: File;
  status: DeliverableFileIssue;
  error: string | null;
};

function toPending(file: File): PendingDeliverableFile {
  const classified = classifyDeliverableFile(file);
  return {
    key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    status: classified.status,
    error: classified.error,
  };
}

export function useDeliverableFiles(initial: PendingDeliverableFile[] = []) {
  const [files, setFiles] = useState<PendingDeliverableFile[]>(initial);
  const [limitError, setLimitError] = useState<string | null>(null);
  const readyFiles = files.filter((row) => row.status === "ready").map((row) => row.file);
  const hasBlocking = files.some((row) => row.status !== "ready");

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list).map(toPending);
    setFiles((current) => {
      if (current.length + incoming.length > DELIVERABLE_FILE_LIMIT) {
        setLimitError(`Add up to ${DELIVERABLE_FILE_LIMIT} files.`);
        return current;
      }
      setLimitError(null);
      return [...current, ...incoming];
    });
  }

  function replaceFile(key: string, file: File) {
    const next = toPending(file);
    setLimitError(null);
    setFiles((current) => current.map((row) => (row.key === key ? { ...next, key } : row)));
  }

  function removeFile(key: string) {
    setLimitError(null);
    setFiles((current) => current.filter((row) => row.key !== key));
  }

  return { files, setFiles, readyFiles, hasBlocking, limitError, addFiles, replaceFile, removeFile };
}

export function DeliverableFileField({
  label = "Attach files",
  files,
  onAdd,
  onReplace,
  onRemove,
  disabled,
  uploading,
  limitError = null,
}: {
  label?: string;
  files: PendingDeliverableFile[];
  onAdd: (list: FileList) => void;
  onReplace: (key: string, file: File) => void;
  onRemove: (key: string) => void;
  disabled?: boolean;
  uploading?: boolean;
  limitError?: string | null;
}) {
  const inputId = useId();
  const replaceKey = useRef<string | null>(null);
  const replaceInputId = useId();

  return (
    <div className="space-y-2">
      <label
        htmlFor={inputId}
        className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-[#E4E9F5] px-3 py-2 text-sm font-semibold text-[#1B1464] ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        {label}
        <input
          id={inputId}
          type="file"
          multiple
          accept={DELIVERABLE_ACCEPT}
          disabled={disabled}
          className="sr-only"
          onChange={(event) => {
            if (event.target.files?.length) onAdd(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      <p className="text-xs text-[#667085]">Up to {DELIVERABLE_FILE_LIMIT} files · 8 MB each · documents, media, or zip.</p>
      {limitError ? (
        <p role="alert" className="rounded-xl bg-[#FFF8F7] px-3 py-2 text-xs font-semibold text-[#B42318]">
          {limitError}
        </p>
      ) : null}
      {files.length > 0 ? (
        <ul className="space-y-2">
          {files.map((row) => (
            <li
              key={row.key}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-sm ${
                row.status === "ready" ? "border-[#E4E9F5] bg-white text-[#1B1464]" : "border-[#F4A3A0] bg-[#FFF8F7] text-[#B42318]"
              }`}
            >
              <span className={row.status === "unsupported" ? "line-through text-[#667085]" : undefined}>
                {row.file.name} · {formatDeliverableBytes(row.file.size)}
                {row.status === "ready" ? " · ready" : row.status === "oversize" ? " · too large" : " · unsupported"}
              </span>
              <span className="flex flex-wrap gap-2">
                {row.status !== "ready" ? (
                  <button
                    type="button"
                    className="inline-flex h-9 items-center rounded-full border border-[#E4E9F5] bg-white px-3 text-xs font-semibold text-[#1B1464]"
                    disabled={disabled}
                    onClick={() => {
                      replaceKey.current = row.key;
                      document.getElementById(replaceInputId)?.click();
                    }}
                  >
                    Replace file
                  </button>
                ) : null}
                <button
                  type="button"
                  className="inline-flex h-9 items-center rounded-full border border-[#E4E9F5] bg-white px-3 text-xs font-semibold text-[#1B1464]"
                  disabled={disabled}
                  onClick={() => onRemove(row.key)}
                >
                  Remove file
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {uploading ? (
        <div className="rounded-2xl border border-[#E4E9F5] bg-[#F6F7FC] px-3 py-3" role="status" aria-live="polite">
          <p className="text-sm font-semibold text-[#1B1464]">Uploading files…</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E4E8F3]">
            <div className="h-full w-full animate-pulse rounded-full bg-[#6D4AFF]/50" />
          </div>
        </div>
      ) : null}
      <input
        id={replaceInputId}
        type="file"
        accept={DELIVERABLE_ACCEPT}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          const key = replaceKey.current;
          if (file && key) onReplace(key, file);
          replaceKey.current = null;
          event.target.value = "";
        }}
      />
    </div>
  );
}
