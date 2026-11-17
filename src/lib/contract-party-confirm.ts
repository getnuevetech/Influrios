/**
 * Confirm parties before drafting. Distinguishes the contracting party from the person who signs.
 */

export type ConfirmedPartySide = {
  role: "business" | "influencer";
  /** Legal / contracting entity shown on the agreement. */
  legalName: string;
  /** Trading name or social handle shown separately when different. */
  tradingName?: string;
  handle?: string;
  /** Person who will sign. */
  signerName: string;
  capacity: string;
  email: string;
  userId?: string | null;
  address?: string;
  missingFields: string[];
};

export type ConfirmPartiesResult = {
  ok: boolean;
  business: ConfirmedPartySide;
  influencer: ConfirmedPartySide;
  blockers: { owner: "business" | "influencer"; field: string; action: string }[];
};

function missing(value: string | null | undefined) {
  return !value?.trim();
}

export function buildConfirmedParty(input: {
  role: "business" | "influencer";
  legalName?: string | null;
  tradingName?: string | null;
  handle?: string | null;
  signerName?: string | null;
  capacity?: string | null;
  email?: string | null;
  userId?: string | null;
  address?: string | null;
}): ConfirmedPartySide {
  const legalName = input.legalName?.trim() || "";
  const signerName = input.signerName?.trim() || "";
  const capacity =
    input.capacity?.trim() ||
    (input.role === "business" ? "Authorized representative" : "Influencer");
  const email = input.email?.trim() || "";
  const handle = input.handle?.trim().replace(/^@/, "") || "";
  const missingFields: string[] = [];
  if (missing(legalName)) missingFields.push("legalName");
  if (missing(signerName)) missingFields.push("signerName");
  if (missing(email)) missingFields.push("email");
  if (input.role === "business" && missing(capacity)) missingFields.push("capacity");
  return {
    role: input.role,
    legalName,
    tradingName: input.tradingName?.trim() || undefined,
    handle: handle || undefined,
    signerName,
    capacity,
    email,
    userId: input.userId ?? null,
    address: input.address?.trim() || undefined,
    missingFields,
  };
}

export function confirmParties(input: {
  business: Parameters<typeof buildConfirmedParty>[0];
  influencer: Parameters<typeof buildConfirmedParty>[0];
}): ConfirmPartiesResult {
  const business = buildConfirmedParty({ ...input.business, role: "business" });
  const influencer = buildConfirmedParty({ ...input.influencer, role: "influencer" });
  const blockers: ConfirmPartiesResult["blockers"] = [];
  for (const field of business.missingFields) {
    blockers.push({
      owner: "business",
      field,
      action: field === "legalName" ? "Complete business legal name" : field === "email" ? "Complete business contact email" : "Complete authorized signer details",
    });
  }
  for (const field of influencer.missingFields) {
    blockers.push({
      owner: "influencer",
      field,
      action:
        field === "legalName"
          ? "Complete influencer contracting name"
          : field === "email"
            ? "Complete influencer contact email"
            : "Complete influencer signer details",
    });
  }
  // Similar names alone are not enough — both sides need distinct confirmed identity fields.
  if (
    business.legalName &&
    influencer.legalName &&
    business.legalName.toLowerCase() === influencer.legalName.toLowerCase()
  ) {
    blockers.push({
      owner: "business",
      field: "legalName",
      action: "Confirm distinct legal names for each party",
    });
  }
  return {
    ok: blockers.length === 0,
    business,
    influencer,
    blockers,
  };
}

/** Snapshot frozen onto the draft when it is issued for signature. */
export function freezePartySnapshot(result: ConfirmPartiesResult) {
  return {
    frozenAt: new Date().toISOString(),
    business: {
      legalName: result.business.legalName,
      tradingName: result.business.tradingName ?? "",
      handle: result.business.handle ?? "",
      signerName: result.business.signerName,
      capacity: result.business.capacity,
      email: result.business.email,
      userId: result.business.userId ?? null,
      address: result.business.address ?? "",
    },
    influencer: {
      legalName: result.influencer.legalName,
      tradingName: result.influencer.tradingName ?? "",
      handle: result.influencer.handle ?? "",
      signerName: result.influencer.signerName,
      capacity: result.influencer.capacity,
      email: result.influencer.email,
      userId: result.influencer.userId ?? null,
      address: result.influencer.address ?? "",
    },
  };
}
