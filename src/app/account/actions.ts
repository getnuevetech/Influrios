"use server";

import { headers } from "next/headers";
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
import {
  AUTH_LOCKOUT_GENERIC_MESSAGE,
  lockoutMessage,
  recordAuthFailure,
  recordAuthSuccess,
} from "@/lib/auth-lockout";

function back(path: string, error: string, next?: string) {
  const url = new URL(path, "http://influrios.local");
  url.searchParams.set("error", error);
  if (next) url.searchParams.set("next", next);
  redirect(`${url.pathname}?${url.searchParams.toString()}`);
}

function clientIp(headerStore: Headers) {
  return headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function actionRegister(formData: FormData) {
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const email = String(formData.get("email") ?? "");
  if (formData.get("consent") !== "on") {
    back("/register", "Consent is required to create an account.", next);
  }
  const headerStore = await headers();
  const ip = clientIp(headerStore);
  const locked = lockoutMessage("register", ip, email);
  if (locked) back("/register", AUTH_LOCKOUT_GENERIC_MESSAGE, next);
  try {
    await registerAccount({
      email,
      name: String(formData.get("name") ?? ""),
      password: String(formData.get("password") ?? ""),
      source: "register",
      ip: ip === "unknown" ? null : ip,
    });
    recordAuthSuccess("register", ip, email);
  } catch (error) {
    recordAuthFailure("register", ip, email);
    back("/register", error instanceof Error ? error.message : "Could not register.", next);
  }
  redirect(`/account/verify?email=${encodeURIComponent(email.trim().toLowerCase())}&next=${encodeURIComponent(next)}`);
}

export async function actionLogin(formData: FormData) {
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const email = String(formData.get("email") ?? "");
  const headerStore = await headers();
  const ip = clientIp(headerStore);
  const locked = lockoutMessage("account-login", ip, email);
  if (locked) back("/login", AUTH_LOCKOUT_GENERIC_MESSAGE, next);
  try {
    await loginAccount(email, String(formData.get("password") ?? ""));
    recordAuthSuccess("account-login", ip, email);
  } catch (error) {
    const coded = error as Error & { code?: string };
    if (coded.code === "unverified") {
      redirect(`/account/verify?email=${encodeURIComponent(email.trim().toLowerCase())}&next=${encodeURIComponent(next)}`);
    }
    recordAuthFailure("account-login", ip, email);
    back("/login", coded.message || "Could not log in.", next);
  }
  redirect(next);
}

export async function actionVerifyEmail(formData: FormData) {
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const email = String(formData.get("email") ?? "");
  const headerStore = await headers();
  const ip = clientIp(headerStore);
  const locked = lockoutMessage("account-verify", ip, email);
  if (locked) {
    redirect(
      `/account/verify?email=${encodeURIComponent(email.trim().toLowerCase())}&next=${encodeURIComponent(next)}&error=${encodeURIComponent(AUTH_LOCKOUT_GENERIC_MESSAGE)}`,
    );
  }
  try {
    await verifyAccountEmail(email, String(formData.get("code") ?? ""));
    recordAuthSuccess("account-verify", ip, email);
  } catch (error) {
    recordAuthFailure("account-verify", ip, email);
    const message = error instanceof Error ? error.message : "Verification failed.";
    redirect(
      `/account/verify?email=${encodeURIComponent(email.trim().toLowerCase())}&next=${encodeURIComponent(next)}&error=${encodeURIComponent(message)}`,
    );
  }
  redirect(next);
}

export async function actionRequestReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const headerStore = await headers();
  const ip = clientIp(headerStore);
  const locked = lockoutMessage("password-reset", ip, email);
  if (locked) {
    redirect("/account/reset?sent=1");
  }
  const token = await requestPasswordReset(email).catch(() => null);
  recordAuthFailure("password-reset", ip, email);
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
