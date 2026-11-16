"use client";

import { useState } from "react";
import { actionApplyDocumentDiscount, actionPreviewCollaborationDiscount, actionRemoveDocumentDiscount } from "@/app/collaboration/discount-actions";
import { formatMinor } from "@/lib/payment-standard-v4";

type Line = { label: string; amountCents: number; tone?: "discount" | "savings"; emphasis?: boolean };

export function QuoteDiscountBox({
  role,
  currency,
  grossCents,
  feeCents,
  taxCents,
  totalCents,
  countryCode,
  serviceLevel,
  readOnly,
  appliedCode = "",
  savingsCents = 0,
  inputName,
  initialTyped = "",
  documentId,
}: {
  role: "business" | "influencer";
  currency: string;
  grossCents: number;
  feeCents: number;
  taxCents: number | null;
  totalCents: number;
  countryCode: string;
  serviceLevel: string;
  readOnly: boolean;
  appliedCode?: string;
  savingsCents?: number;
  inputName?: string;
  initialTyped?: string;
  documentId?: string;
}) {
  const [open, setOpen] = useState(Boolean(initialTyped) && !appliedCode);
  const [typed, setTyped] = useState(initialTyped);
  const [code, setCode] = useState(appliedCode);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [lines, setLines] = useState<Line[]>(initialLines());

  function initialLines(): Line[] {
    if (role === "business") {
      return [
        { label: "Gross compensation", amountCents: grossCents },
        { label: "Business fee", amountCents: feeCents },
        ...(savingsCents > 0 ? [{ label: "Fee discount", amountCents: savingsCents, tone: "discount" as const }] : []),
        ...(taxCents == null ? [] : [{ label: "Tax", amountCents: taxCents }]),
        { label: "You pay", amountCents: totalCents, emphasis: true },
      ];
    }
    return [
      { label: "Gross compensation", amountCents: grossCents },
      { label: "Influencer fee", amountCents: feeCents, tone: "discount" as const },
      ...(savingsCents > 0 ? [{ label: "Fee savings", amountCents: savingsCents, tone: "savings" as const }] : []),
      ...(taxCents == null ? [] : [{ label: "Tax", amountCents: taxCents }]),
      { label: "Your net payout", amountCents: totalCents, emphasis: true },
    ];
  }

  async function apply() {
    setPending(true);
    const result = documentId
      ? await actionApplyDocumentDiscount({ documentId, code: typed, role })
      : await actionPreviewCollaborationDiscount({
          code: typed,
          role,
          grossCents,
          countryCode,
          currency,
          serviceLevel,
        });
    setPending(false);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setError("");
    setCode(result.code);
    setLines(result.lines);
    setOpen(false);
  }

  async function remove() {
    if (documentId && code) {
      const result = await actionRemoveDocumentDiscount({ documentId, role, code });
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      setCode("");
      setTyped("");
      setError("");
      setLines(result.lines);
      return;
    }
    setCode("");
    setTyped("");
    setError("");
    setLines(initialLines().filter((line) => line.label !== "Fee discount" && line.label !== "Fee savings"));
  }

  return (
    <div className="mt-3 space-y-3">
      {inputName ? <input type="hidden" name={inputName} value={code} /> : null}
      {readOnly ? (
        code ? <p className="text-sm text-indigo">Applied code <span className="rounded-full bg-[#F4F0FF] px-2 py-1 font-semibold text-violet">{code}</span> saves {formatMinor(savingsCents, currency)}. This agreed discount stays on the signed breakdown.</p> : null
      ) : code ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span>Applied code</span>
          <span className="rounded-full bg-[#F4F0FF] px-2 py-1 font-semibold text-violet">{code}</span>
          <button type="button" className="font-semibold text-violet" onClick={() => void remove()}>Remove</button>
        </p>
      ) : open ? (
        <div className="flex flex-wrap items-center gap-2">
          <input value={typed} onChange={(event) => setTyped(event.target.value)} className="h-11 min-w-40 flex-1 rounded-xl border px-3 text-sm" aria-label="Discount code" />
          <button type="button" disabled={pending} onClick={() => void apply()} className="h-11 rounded-full bg-violet px-4 text-sm font-semibold text-white">{pending ? "Applying" : "Apply"}</button>
        </div>
      ) : (
        <button type="button" className="text-sm font-semibold text-violet" onClick={() => setOpen(true)}>Add discount code</button>
      )}
      {error ? <p className="text-sm font-semibold text-amber-800">{error}</p> : null}
      <dl className="space-y-2 text-sm">
        {lines.map((line) => (
          <div key={line.label} className={`flex justify-between gap-3 ${line.emphasis ? "font-bold text-indigo" : ""}`}>
            <dt>{line.label}</dt>
            <dd className={line.tone === "discount" ? "font-semibold text-emerald-700" : line.tone === "savings" ? "font-semibold text-emerald-700" : ""}>
              {line.tone === "discount" ? "−" : line.tone === "savings" ? "+" : ""}
              {formatMinor(line.amountCents, currency)}
            </dd>
          </div>
        ))}
      </dl>
      {role === "business" && code ? <p className="text-xs text-muted">The influencer’s compensation stays the same. Tax uses the discounted fee.</p> : null}
      {role === "influencer" && code ? <p className="text-xs text-muted">The business still pays the agreed total. Your fee savings increase your net payout.</p> : null}
    </div>
  );
}
