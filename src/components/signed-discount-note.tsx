import { readDiscountAdjustments } from "@/lib/discount-codes";
import { formatMinor } from "@/lib/payment-standard-v4";

export function SignedDiscountNote({ plan, currency }: { plan: unknown; currency: string }) {
  const rows = readDiscountAdjustments(plan);
  if (rows.length === 0) return null;
  return (
    <div className="space-y-1 text-sm">
      {rows.map((row) => (
        <p key={`${row.charge}:${row.code}`}>
          Applied code <span className="rounded-full bg-[#F4F0FF] px-2 py-0.5 font-semibold text-violet">{row.code}</span>{" "}
          saves {formatMinor(row.discountCents, currency)}. This agreed discount is read-only.
        </p>
      ))}
    </div>
  );
}
