"use client";

export function ContactAddressFields({
  line1Name = "addressLine1",
  line2Name = "addressLine2",
  postalName = "postalCode",
  defaultLine1 = "",
  defaultLine2 = "",
  defaultPostal = "",
  className = "space-y-3",
  disabled = false,
}: {
  line1Name?: string;
  line2Name?: string;
  postalName?: string;
  defaultLine1?: string;
  defaultLine2?: string;
  defaultPostal?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-semibold text-indigo">
        Street address
        <input
          name={line1Name}
          defaultValue={defaultLine1}
          disabled={disabled}
          autoComplete="address-line1"
          placeholder="Street, building, and number"
          className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
        />
      </label>
      <label className="block text-sm font-semibold text-indigo">
        Apartment, suite, or unit
        <input
          name={line2Name}
          defaultValue={defaultLine2}
          disabled={disabled}
          autoComplete="address-line2"
          placeholder="Optional"
          className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
        />
      </label>
      <label className="block text-sm font-semibold text-indigo">
        Postal code
        <input
          name={postalName}
          defaultValue={defaultPostal}
          disabled={disabled}
          autoComplete="postal-code"
          className="mt-1 w-full rounded-xl border border-border px-3 py-2 font-normal"
        />
      </label>
    </div>
  );
}
