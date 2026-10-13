"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isDefaultMemberHome, safeNextPath } from "@/lib/account-policy";
import {
  clearAccountSession,
  getAccountSession,
  homePathForRole,
  loginAccount,
  registerAccount,
  requestPasswordReset,
  resendAccountVerification,
  resetPassword,
  setAccountPassword,
  verifyAccountEmail,
} from "@/lib/accounts";
import {
  AUTH_LOCKOUT_GENERIC_MESSAGE,
  lockoutMessage,
  recordAuthFailure,
  recordAuthSuccess,
} from "@/lib/auth-lockout";
import { REFERRAL_COOKIE } from "@/lib/referral-cookie";
import { recordReferralRegistration } from "@/lib/referrals";

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
    const user = await registerAccount({
      email,
      name: String(formData.get("name") ?? ""),
      password: String(formData.get("password") ?? ""),
      source: "register",
      ip: ip === "unknown" ? null : ip,
    });
    const jar = await cookies();
    const shortLinkId = jar.get(REFERRAL_COOKIE)?.value ?? "";
    if (shortLinkId) {
      await recordReferralRegistration({
        userId: user.id,
        email: user.email,
        shortLinkId,
      }).catch((error) => {
        console.error("referral registration", error);
      });
      jar.set(REFERRAL_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
    }
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
  let user: Awaited<ReturnType<typeof loginAccount>> | null = null;
  try {
    user = await loginAccount(email, String(formData.get("password") ?? ""));
    recordAuthSuccess("account-login", ip, email);
  } catch (error) {
    const coded = error as Error & { code?: string };
    if (coded.code === "unverified") {
      redirect(`/account/verify?email=${encodeURIComponent(email.trim().toLowerCase())}&next=${encodeURIComponent(next)}`);
    }
    recordAuthFailure("account-login", ip, email);
    back("/login", coded.message || "Could not log in.", next);
  }
  const destination = isDefaultMemberHome(next) ? homePathForRole(user?.role) : next;
  redirect(destination);
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
  let user: Awaited<ReturnType<typeof verifyAccountEmail>> | null = null;
  try {
    user = await verifyAccountEmail(email, String(formData.get("code") ?? ""));
    recordAuthSuccess("account-verify", ip, email);
  } catch (error) {
    recordAuthFailure("account-verify", ip, email);
    const message = error instanceof Error ? error.message : "Verification failed.";
    redirect(
      `/account/verify?email=${encodeURIComponent(email.trim().toLowerCase())}&next=${encodeURIComponent(next)}&error=${encodeURIComponent(message)}`,
    );
  }
  if (!user?.passwordHash) {
    redirect(`/account/password?next=${encodeURIComponent(isDefaultMemberHome(next) ? homePathForRole(user?.role) : next)}`);
  }
  const destination = isDefaultMemberHome(next) ? homePathForRole(user?.role) : next;
  // First verification: send incomplete profiles to edit once; login later uses the dashboard.
  if (destination === "/creator") {
    redirect(`${destination}?welcome=1`);
  }
  redirect(destination);
}

export async function actionResendVerification(formData: FormData) {
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const headerStore = await headers();
  const ip = clientIp(headerStore);
  const locked = lockoutMessage("account-verify", ip, email);
  if (locked) {
    redirect(
      `/account/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}&error=${encodeURIComponent(AUTH_LOCKOUT_GENERIC_MESSAGE)}`,
    );
  }
  try {
    await resendAccountVerification(email);
    recordAuthSuccess("account-verify", ip, email);
  } catch (error) {
    recordAuthFailure("account-verify", ip, email);
    const message = error instanceof Error ? error.message : "Could not resend the code.";
    redirect(
      `/account/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}&error=${encodeURIComponent(message)}`,
    );
  }
  redirect(
    `/account/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}&resent=1`,
  );
}

export async function actionRequestReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const headerStore = await headers();
  const ip = clientIp(headerStore);
  const locked = lockoutMessage("password-reset", ip, email);
  if (locked) {
    redirect("/account/reset?sent=1");
  }
  await requestPasswordReset(email).catch(() => null);
  recordAuthFailure("password-reset", ip, email);
  redirect("/account/reset?sent=1");
}

export async function actionResetPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  try {
    await resetPassword(token, String(formData.get("password") ?? ""));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reset failed.";
    redirect(`/account/reset?token=${encodeURIComponent(token)}&error=${encodeURIComponent(message)}`);
  }
  const session = await getAccountSession().catch(() => null);
  redirect(homePathForRole(session?.role));
}

export async function actionSetPassword(formData: FormData) {
  const session = await getAccountSession();
  if (!session) redirect("/login?next=/account/password");
  const next = safeNextPath(String(formData.get("next") ?? ""), homePathForRole(session.role));
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) {
    redirect(
      `/account/password?next=${encodeURIComponent(next)}&error=${encodeURIComponent("Passwords do not match.")}`,
    );
  }
  try {
    await setAccountPassword(session.id, password);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save password.";
    redirect(`/account/password?next=${encodeURIComponent(next)}&error=${encodeURIComponent(message)}`);
  }
  redirect(next);
}

export async function actionLogout() {
  await clearAccountSession();
  redirect("/");
}

export async function actionSaveCommPreference(formData: FormData) {
  const session = await getAccountSession();
  if (!session) redirect("/login?next=/account");
  try {
    const { setUserCommPreference } = await import("@/lib/comm-templates");
    await setUserCommPreference({
      userId: session.id,
      phone: String(formData.get("phone") ?? ""),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save preference.";
    redirect(`/account?error=${encodeURIComponent(message)}`);
  }
  redirect("/account?saved=1");
}
