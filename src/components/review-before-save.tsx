"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { countryRouteReview, feeRuleReview, type SettingsReview } from "@/app/admin/payment-settings/owner";

type ReviewKind = "country-route" | "fee-rule";

function buildReview(kind: ReviewKind, data: FormData): SettingsReview {
  return kind === "country-route" ? countryRouteReview(data) : feeRuleReview(data);
}

export function ReviewBeforeSave({
  action,
  kind,
  className,
  triggerLabel,
  triggerClassName,
  confirmLabel = "Save",
  formId,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  kind: ReviewKind;
  className?: string;
  triggerLabel?: string;
  triggerClassName?: string;
  confirmLabel?: string;
  formId?: string;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmed = useRef(false);
  const titleId = useId();
  const [review, setReview] = useState<SettingsReview | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (review && !dialog.open) dialog.showModal();
    if (!review && dialog.open) dialog.close();
  }, [review]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!triggerLabel) {
      event.preventDefault();
      return;
    }
    if (confirmed.current) {
      confirmed.current = false;
      setReview(null);
      return;
    }
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    setReview(buildReview(kind, new FormData(form)));
  }

  return (
    <form ref={formRef} id={formId} action={action} className={className} onSubmit={onSubmit}>
      {children}
      {triggerLabel ? (
        <button type="submit" className={triggerClassName}>
          {triggerLabel}
        </button>
      ) : null}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="w-[min(560px,calc(100%-2rem))] rounded-2xl border border-[#E4EBFF] p-0 text-indigo shadow-xl backdrop:bg-[#171C55]/40 max-md:h-full max-md:max-h-none max-md:w-full max-md:max-w-none max-md:rounded-none"
        onClose={() => setReview(null)}
      >
        {review ? (
          <div className="flex max-h-[90vh] flex-col max-md:h-full max-md:max-h-none">
            <header className="flex items-start justify-between gap-3 border-b border-[#E4EBFF] px-5 py-4">
              <h2 id={titleId} className="font-display text-xl font-bold text-indigo">
                {review.title}
              </h2>
              <button
                type="button"
                className="rounded-full px-2 py-1 text-sm font-bold text-muted hover:text-indigo"
                aria-label={`Close ${review.title}`}
                onClick={() => setReview(null)}
              >
                ✕
              </button>
            </header>
            <div className="space-y-4 overflow-y-auto px-5 py-4">
              <p className="font-display text-lg font-bold text-indigo">{review.heading}</p>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                {review.lines.map((line) => (
                  <div key={line.label}>
                    <dt className="text-xs font-semibold text-muted">{line.label}</dt>
                    <dd className="font-semibold">{line.value}</dd>
                  </div>
                ))}
              </dl>
              {review.checks.length > 0 ? (
                <div>
                  <p className="text-sm font-bold">Payment capability checklist</p>
                  <ul className="mt-2 space-y-2">
                    {review.checks.map((check) => (
                      <li key={check.label} className="flex items-center justify-between gap-3 text-sm">
                        <span>{check.label}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            check.value === "Configured"
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-amber-50 text-amber-800"
                          }`}
                        >
                          {check.value}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="text-sm text-muted">{review.note}</p>
            </div>
            <footer className="flex items-center justify-end gap-2 border-t border-[#E4EBFF] px-5 py-4">
              <button
                type="button"
                className="rounded-full border border-[#E4EBFF] px-4 py-2 text-sm font-bold"
                onClick={() => setReview(null)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-[#5836D6] px-4 py-2 text-sm font-bold text-white"
                onClick={() => {
                  confirmed.current = true;
                }}
              >
                {confirmLabel}
              </button>
            </footer>
          </div>
        ) : null}
      </dialog>
    </form>
  );
}
