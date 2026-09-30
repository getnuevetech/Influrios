import { redirect } from "next/navigation";
import { resolveQrPath } from "@/lib/qr-identity";

type Props = { params: Promise<{ token: string }> };

/** Dynamic QR landing. Opaque tokens resolve through qr_identity; older links may still be slugs. */
export default async function DynamicQrRedirectPage({ params }: Props) {
  const { token } = await params;
  const path = await resolveQrPath(token);
  redirect(path ?? "/discover");
}
