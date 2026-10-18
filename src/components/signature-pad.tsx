"use client";

import { useMemo, useState } from "react";
import { renderNameSignature, signatureInitials, signatureToSvg } from "@/lib/signing/signature-engine";

type Props = {
  name: string;
  defaultValue?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
};

/**
 * Live name → signature preview for in-app e-sign.
 * Shows Caveat cursive text plus the same stroke engine used in the PDF.
 */
export function SignaturePad({ name, defaultValue = "", required, minLength = 2, maxLength = 160 }: Props) {
  const [value, setValue] = useState(defaultValue);

  const preview = useMemo(() => {
    const trimmed = value.trim();
    if (trimmed.length < 2) return null;
    const signature = renderNameSignature(trimmed, { emSize: 22 });
    return {
      initials: signatureInitials(trimmed),
      svg: signatureToSvg(signature, { stroke: "#1a1440" }),
    };
  }, [value]);

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-indigo">
        Legal name (your electronic signature)
        <input
          name={name}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="name"
          className="mt-1 w-full rounded-xl border border-border px-3 py-2.5 font-normal"
          placeholder="Type your full legal name"
        />
      </label>

      <div className="rounded-xl border border-[#D9DFF2] bg-[#FAFBFF] p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet">Signature preview</p>
        {preview ? (
          <div className="mt-3 space-y-3">
            <p className="font-script text-[2.1rem] leading-none text-[#1a1440]">{value.trim()}</p>
            <div
              className="overflow-x-auto border-b border-[#C8D0E8] pb-2"
              dangerouslySetInnerHTML={{ __html: preview.svg }}
            />
            <p className="text-xs text-muted">
              Page endorsement initials: <span className="font-semibold text-indigo">{preview.initials}</span>
              {" · "}
              This ink mark is stamped on the agreement PDF and initialed on every page.
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">Start typing your legal name to see your handwritten signature.</p>
        )}
      </div>
    </div>
  );
}
