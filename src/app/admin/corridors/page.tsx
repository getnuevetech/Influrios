import { redirect } from "next/navigation";
import { paymentSettingsHref } from "@/app/admin/payment-settings/owner";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminCorridorsPage({ searchParams }: Props) {
  redirect(paymentSettingsHref("routes", await searchParams));
}
