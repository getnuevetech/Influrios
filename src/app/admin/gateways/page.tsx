import { redirect } from "next/navigation";
import { paymentSettingsHref } from "@/app/admin/payment-settings/owner";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminGatewaysPage({ searchParams }: Props) {
  redirect(paymentSettingsHref("providers", await searchParams));
}
