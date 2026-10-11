/** The two KYC paths a country corridor can use. */
export const KYC_TYPES = [
  {
    code: "gateway",
    label: "KYC through gateway",
    detail:
      "The creator completes KYC with the payment gateway. The United States can use this through Stripe.",
  },
  {
    code: "government_id",
    label: "KYC through government ID",
    detail:
      "The creator uploads 2–3 government-issued IDs and enters the ID details, address, date of birth, and other required information.",
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
