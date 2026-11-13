import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create account" };

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function RegisterPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.next) query.set("next", params.next);
  if (params.error) query.set("error", params.error);
  const suffix = query.toString();
  redirect(suffix ? `/signup?${suffix}` : "/signup");
}
