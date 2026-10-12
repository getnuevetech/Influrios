import { notFound, redirect } from "next/navigation";
import { qrLandingFromHit, resolveQrToken } from "@/lib/short-link";

type Props = { params: Promise<{ token: string }> };

/** Opaque QR landing on the app host. The token is never resolved as a creator slug. */
export default async function DynamicQrRedirectPage({ params }: Props) {
  const { token } = await params;
  const hit = await resolveQrToken(token).catch(() => null);
  if (!hit) notFound();
  const landing = qrLandingFromHit(hit);
  if (landing === "redirect" && hit.kind === "redirect") redirect(hit.location);
  if (landing === "suspended" && hit.kind === "page") {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="font-display text-2xl font-bold text-indigo">{hit.title}</h1>
        <p className="mt-3 text-sm text-muted">{hit.message}</p>
      </main>
    );
  }
  notFound();
}
