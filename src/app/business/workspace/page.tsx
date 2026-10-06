import { redirect } from "next/navigation";
import { collabOsV1Enabled } from "@/lib/collab-os";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Business Collaboration Hub · Influrios",
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Legacy workspace URL — Collaboration OS P2b hub lives at /collaboration/business. */
export default async function BusinessWorkspaceRedirect({ searchParams }: Props) {
  if (!(await collabOsV1Enabled().catch(() => true))) {
    redirect("/collaboration/propose?notice=collab_os_off");
  }
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value) qs.set(key, value);
    else if (Array.isArray(value) && value[0]) qs.set(key, value[0]);
  }
  const suffix = qs.toString();
  redirect(suffix ? `/collaboration/business?${suffix}` : "/collaboration/business");
}
