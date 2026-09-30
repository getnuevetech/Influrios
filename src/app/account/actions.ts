"use server";

import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/account-policy";
import {
  clearAccountSession,
  loginAccount,
  registerAccount,
  requestPasswordReset,
  resetPassword,
  verifyAccountEmail,
} from "@/lib/accounts";

function back(path: string, error: string, next?: string) {
  const url = new URL(path, "http://influrios.local");
  url.searchParams.set("error", error);
  if (next) url.searchParams.set("next", next);
  redirect(`${url.pathname}?${url.searchParams.toString()}`);
}

export async function actionRegister(formData: FormData) {
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const email = String(formData.get("email") ?? "");
  if (formData.get("consent") !== "on") {
    back("/register", "Consent is required to create an account.", next);
  }
  try {
    await registerAccount({
      email,
      name: String(formData.get("name") ?? ""),
      password: String(formData.get("password") ?? ""),
      source: "register",
    });
  } catch (error) {
    back("/register", error instanceof Error ? error.message : "Could not register.", next);
  }
  redirect(`/account/verify?email=${encodeURIComponent(email.trim().toLowerCase())}&next=${encodeURIComponent(next)}`);
}

export async function actionLogin(formData: FormData) {
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const email = String(formData.get("email") ?? "");
  try {
    await loginAccount(email, String(formData.get("password") ?? ""));
  } catch (error) {
    const coded = error as Error & { code?: string };
    if (coded.code === "unverified") {
      redirect(`/account/verify?email=${encodeURIComponent(email.trim().toLowerCase())}&next=${encodeURIComponent(next)}`);
    }
    back("/login", coded.message || "Could not log in.", next);
  }
  redirect(next);
}

export async function actionVerifyEmail(formData: FormData) {
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const email = String(formData.get("email") ?? "");
  try {
    await verifyAccountEmail(email, String(formData.get("code") ?? ""));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verification failed.";
    redirect(
      `/account/verify?email=${encodeURIComponent(email.trim().toLowerCase())}&next=${encodeURIComponent(next)}&error=${encodeURIComponent(message)}`,
    );
  }
  redirect(next);
}

export async function actionRequestReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = await requestPasswordReset(email).catch(() => null);
  if (!token) {
    redirect("/account/reset?sent=1");
  }
  redirect(`/account/reset?sent=1&token=${encodeURIComponent(token)}`);
}

export async function actionResetPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  try {
    await resetPassword(token, String(formData.get("password") ?? ""));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reset failed.";
    redirect(`/account/reset?token=${encodeURIComponent(token)}&error=${encodeURIComponent(message)}`);
  }
  redirect("/");
}

export async function actionLogout() {
  await clearAccountSession();
  redirect("/");
}
