import { notFound, redirect } from "next/navigation";
import { resolveQrToken } from "@/lib/short-link";

type Props = { params: Promise<{ token: string }> };

/** Opaque QR landing on the app host. The token is never resolved as a creator slug. */
export default async function DynamicQrRedirectPage({ params }: Props) {
  const { token } = await params;
  const hit = await resolveQrToken(token).catch(() => null);
  if (hit?.kind === "redirect") redirect(hit.location);
  notFound();
}
