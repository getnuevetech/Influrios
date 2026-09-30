import { redirect } from "next/navigation";
import { getDirectoryCreator } from "@/lib/directory";

type Props = { params: Promise<{ token: string }> };

/** Pro dynamic QR landing — token currently equals creator slug (opaque IDs later). */
export default async function DynamicQrRedirectPage({ params }: Props) {
  const { token } = await params;
  const creator = await getDirectoryCreator(token);
  if (!creator) {
    redirect("/discover");
  }
  redirect(`/c/${creator.slug}`);
}
