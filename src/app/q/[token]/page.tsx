import { redirect } from "next/navigation";
import { getCreatorBySlug } from "@/lib/seed-data";

type Props = { params: Promise<{ token: string }> };

/** Pro dynamic QR landing — token currently equals creator slug (opaque IDs later). */
export default async function DynamicQrRedirectPage({ params }: Props) {
  const { token } = await params;
  const creator = getCreatorBySlug(token);
  if (!creator) {
    redirect("/discover");
  }
  redirect(`/c/${creator.slug}`);
}
