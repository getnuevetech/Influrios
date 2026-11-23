"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary !py-2 text-sm">
      Download as PDF
    </button>
  );
}
