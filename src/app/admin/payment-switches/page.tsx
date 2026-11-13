import { redirect } from "next/navigation";
import { paymentSettingsHref } from "@/app/admin/payment-settings/owner";

export default async function PaymentSwitchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(paymentSettingsHref("fees", await searchParams, "payment-switches"));
}
