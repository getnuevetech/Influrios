"use server";

import { redirect } from "next/navigation";

/** Demo JSON disputes are removed. Open a provider-held dispute from Protected Payments. */
export async function actionOpenDispute(_formData: FormData) {
  redirect("/payments?error=Open a dispute on the provider-held milestone.");
}
