/** Cookie set on the app host after a short-link visit. The value is the short link id. */
export const REFERRAL_COOKIE = "influrios_referral";

const REFERRAL_ID = /^[a-z0-9]{10,40}$/i;

export function referralId(value: string | null | undefined): string {
  const id = (value ?? "").trim();
  return REFERRAL_ID.test(id) ? id : "";
}

/** Add the short link id to an app destination so the app host can store the referral. */
export function withReferralParam(location: string, shortLinkId: string): string {
  const id = referralId(shortLinkId);
  if (!id) return location;
  try {
    const url = new URL(location);
    if (!url.searchParams.get("ref")) url.searchParams.set("ref", id);
    return url.toString();
  } catch {
    return location;
  }
}
