import { qrPayloadForSlug, resolveQrToken } from "@/lib/short-link";

/** App-host compatibility for /q/{token}. Unknown tokens are not treated as slugs. */
export async function resolveQrPath(token: string): Promise<string | null> {
  try {
    const hit = await resolveQrToken(token);
    return hit.kind === "redirect" ? hit.location : null;
  } catch {
    return null;
  }
}

/** Permanent QR payload is https://{short-domain}/q/{opaque}. */
export async function dynamicQrTokenForSlug(slug: string): Promise<string> {
  const payload = await qrPayloadForSlug(slug).catch(() => null);
  return payload ?? "";
}
