import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Details & Preferences" };

type Props = {
  searchParams: Promise<{ saved?: string; error?: string; tab?: string }>;
};

/** Deep links from Overview Manage buttons land on Details & Preferences. */
export default async function ProfilePreferencesRedirect({ searchParams }: Props) {
  const params = await searchParams;
  const q = new URLSearchParams();
  if (params.saved) q.set("saved", params.saved);
  if (params.error) q.set("error", params.error);
  if (params.tab) q.set("tab", params.tab);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  redirect(`/dashboard/details${suffix}`);
}
