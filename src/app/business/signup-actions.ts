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

function cleanEmail(value: string) {
  return value.trim().toLowerCase().slice(0, 254);
}

/** Business marketing signup: creates the User (role BUSINESS) + owned workspace in one step. */
export async function actionRegisterBusiness(formData: FormData) {
  if (formData.get("consent") !== "on") {
    back("Agree to the business account terms and privacy policy to continue.");
  }

  const businessName = String(formData.get("businessName") ?? "").trim().slice(0, 120);
  const email = cleanEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const country = String(formData.get("country") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const businessType = String(formData.get("businessType") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim().slice(0, 120);
  const contactEmail = cleanEmail(String(formData.get("contactEmail") ?? ""));
  const contactPhone = String(formData.get("contactPhone") ?? "").trim().slice(0, 40);

  if (!businessName) back("Business name is required.");
  if (!email) back("Business email is required.");
  if (!country) back("Country is required.");
  if (password !== confirmPassword) back("Passwords do not match.");
  if (!contactName) back("Contact person's full name is required.");
  if (!contactPhone) back("Contact person's mobile is required.");
  if (!contactEmail) back("Contact person's email is required.");

  const headerStore = await headers();
  const ip = clientIp(headerStore);

  let userId: string;
  try {
    // Account identity is the business: name + email for login. Contact person is profile-only.
    const user = await registerAccount({
      email,
      name: businessName,
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
    await prisma.businessProfile.update({
      where: { userId },
      data: {
        ...(geography ? { geography } : {}),
        contactName,
        contactEmail,
        contactPhone,
      },
    });
    // registerAccount already records registration docs; also accept business-terms at signup.
    const { recordLegalEvent } = await import("@/lib/legal");
    await recordLegalEvent({
      trigger: "business_registration",
      context: "business_registration",
      userId,
      userRole: "BUSINESS",
      ip: ip === "unknown" ? null : ip,
      extraKeys: ["terms-of-service", "privacy-policy"],
    });
  } catch (error) {
    back(error instanceof Error ? error.message : "Could not set up the business workspace.");
  }

  redirect(
    `/account/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent("/business/home")}`,
  );
}
