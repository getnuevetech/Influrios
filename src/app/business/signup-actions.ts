"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { registerAccount } from "@/lib/accounts";
import { ensureOwnedBusinessWorkspace } from "@/lib/business";
import { prisma } from "@/lib/db";

function clientIp(headerStore: Headers) {
  return headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

function back(error: string): never {
  redirect(`/business?error=${encodeURIComponent(error)}#create-profile`);
}

/** Business marketing signup: creates the User (role BUSINESS) + owned workspace in one step. */
export async function actionRegisterBusiness(formData: FormData) {
  if (formData.get("consent") !== "on") {
    back("Agree to the Terms of Service and Privacy Policy to continue.");
  }

  const businessName = String(formData.get("businessName") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const country = String(formData.get("country") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const businessType = String(formData.get("businessType") ?? "").trim();

  if (!businessName) back("Business name is required.");
  if (!contactName) back("Contact person's full name is required.");
  if (!country) back("Country is required.");
  if (password !== confirmPassword) back("Passwords do not match.");

  const headerStore = await headers();
  const ip = clientIp(headerStore);

  let userId: string;
  try {
    const user = await registerAccount({
      email,
      name: contactName,
      password,
      source: "business-register",
      ip: ip === "unknown" ? null : ip,
      role: "BUSINESS",
    });
    userId = user.id;
  } catch (error) {
    back(error instanceof Error ? error.message : "Could not register.");
  }

  try {
    await ensureOwnedBusinessWorkspace(userId, {
      name: businessName,
      industry: businessType,
    });
    const geography = [city, state, country].filter(Boolean).join(", ");
    if (geography) {
      await prisma.businessProfile.update({
        where: { userId },
        data: { geography },
      });
    }
  } catch (error) {
    back(error instanceof Error ? error.message : "Could not set up the business workspace.");
  }

  redirect(
    `/account/verify?email=${encodeURIComponent(email.trim().toLowerCase())}&next=${encodeURIComponent("/business/home")}`,
  );
}
