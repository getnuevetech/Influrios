/** The two KYC paths a country corridor can use. */
export const KYC_TYPES = [
  {
    code: "gateway",
    label: "KYC by Gateway",
    detail:
      "The creator completes KYC with the payment gateway assigned for this corridor (for example Stripe Connect identity).",
  },
  {
    code: "government_id",
    label: "KYC by Document Upload",
    detail:
      "The creator uploads the configured identity documents and enters the required details (ID numbers, address, date of birth, and so on).",
  },
] as const;

export type KycTypeCode = (typeof KYC_TYPES)[number]["code"];

export function kycTypeByCode(value: string | null | undefined) {
  const code = (value ?? "").trim();
  return KYC_TYPES.find((type) => type.code === code) ?? null;
}

export function requireKycType(value: string | null | undefined) {
  const type = kycTypeByCode(value);
  if (!type) throw new Error("Choose a KYC type.");
  return type;
}
