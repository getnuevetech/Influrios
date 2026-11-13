"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { isDefaultMemberHome, safeNextPath } from "@/lib/account-policy";
import { loginDestination, recipientEmailForReturn } from "@/lib/invite-return";
import {
  accountEmailMatches,
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
  const requestedReturn = String(formData.get("returnTo") ?? "");
  const returnTo =
    requestedReturn === "/claim" || requestedReturn === "/register" || requestedReturn === "/signup"
      ? requestedReturn
      : "/signup";
  const role = String(formData.get("role") ?? "") === "BUSINESS" ? "BUSINESS" : "CREATOR";
  if (formData.get("consent") !== "on") {
    back(returnTo, "Consent is required to create an account.", next);
  }
  const headerStore = await headers();
  const ip = clientIp(headerStore);
  const locked = await lockoutMessage("register", ip, email);
  if (locked) back(returnTo, AUTH_LOCKOUT_GENERIC_MESSAGE, next);
  try {
    const user = await registerAccount({
      email,
      name: String(formData.get("name") ?? ""),
      password: String(formData.get("password") ?? ""),
      source: "register",
      ip: ip === "unknown" ? null : ip,
      role,
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
    await recordAuthSuccess("register", ip, email);
  } catch (error) {
    await recordAuthFailure("register", ip, email);
    back(returnTo, error instanceof Error ? error.message : "Could not register.", next);
  }
  const verifyNext =
    role === "BUSINESS" && (next === "/creator" || next.startsWith("/creator?")) ? "/business" : next;
  redirect(`/account/verify?email=${encodeURIComponent(email.trim().toLowerCase())}&next=${encodeURIComponent(verifyNext)}`);
}

export async function actionLogin(formData: FormData) {
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const email = String(formData.get("email") ?? "");
  const headerStore = await headers();
  const ip = clientIp(headerStore);
  const locked = await lockoutMessage("account-login", ip, email);
  if (locked) back("/login", AUTH_LOCKOUT_GENERIC_MESSAGE, next);
  let user: Awaited<ReturnType<typeof loginAccount>> | null = null;
  try {
    user = await loginAccount(email, String(formData.get("password") ?? ""));
    if (!user || !accountEmailMatches(user.email, email)) {
      await clearAccountSession();
      back("/login", "That email does not match the account that was signed in.", next);
    }
    await recordAuthSuccess("account-login", ip, email);
  } catch (error) {
    const coded = error as Error & { code?: string };
    if (coded.code === "unverified") {
      redirect(`/account/verify?email=${encodeURIComponent(email.trim().toLowerCase())}&next=${encodeURIComponent(next)}`);
    }
    await recordAuthFailure("account-login", ip, email);
    back("/login", coded.message || "Could not log in.", next);
  }
  const fallback = homePathForRole(user?.role);
  const requested = isDefaultMemberHome(next) ? fallback : next;
  const destination = loginDestination({
    next: requested,
    accountEmail: user?.email ?? email,
    recipientEmail: await recipientEmailForReturn(requested),
    fallback,
  });
  redirect(destination);
}

export async function actionVerifyEmail(formData: FormData) {
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const email = String(formData.get("email") ?? "");
  const headerStore = await headers();
  const ip = clientIp(headerStore);
  const locked = await lockoutMessage("account-verify", ip, email);
  if (locked) {
    redirect(
      `/account/verify?email=${encodeURIComponent(email.trim().toLowerCase())}&next=${encodeURIComponent(next)}&error=${encodeURIComponent(AUTH_LOCKOUT_GENERIC_MESSAGE)}`,
    );
  }
  let user: Awaited<ReturnType<typeof verifyAccountEmail>> | null = null;
  try {
    user = await verifyAccountEmail(email, String(formData.get("code") ?? ""));
    await recordAuthSuccess("account-verify", ip, email);
  } catch (error) {
    await recordAuthFailure("account-verify", ip, email);
    const message = error instanceof Error ? error.message : "Verification failed.";
    redirect(
      `/account/verify?email=${encodeURIComponent(email.trim().toLowerCase())}&next=${encodeURIComponent(next)}&error=${encodeURIComponent(message)}`,
    );
  }
  if (!user?.passwordHash) {
    redirect(`/account/password?next=${encodeURIComponent(isDefaultMemberHome(next) ? homePathForRole(user?.role) : next)}`);
  }
  const fallback = homePathForRole(user?.role);
  const requested = isDefaultMemberHome(next) ? fallback : next;
  const destination = loginDestination({
    next: requested,
    accountEmail: user.email,
    recipientEmail: await recipientEmailForReturn(requested),
    fallback,
  });
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
  const locked = await lockoutMessage("account-verify", ip, email);
  if (locked) {
    redirect(
      `/account/verify?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}&error=${encodeURIComponent(AUTH_LOCKOUT_GENERIC_MESSAGE)}`,
    );
  }
  try {
    await resendAccountVerification(email);
    await recordAuthSuccess("account-verify", ip, email);
  } catch (error) {
    await recordAuthFailure("account-verify", ip, email);
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
  const locked = await lockoutMessage("password-reset", ip, email);
  if (locked) {
    redirect("/account/reset?sent=1");
  }
  await requestPasswordReset(email).catch(() => null);
  await recordAuthFailure("password-reset", ip, email);
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
  const fallback = homePathForRole(session.role);
  redirect(
    loginDestination({
      next,
      accountEmail: session.email,
      recipientEmail: await recipientEmailForReturn(next),
      fallback,
    }),
  );
}

export async function actionLogout(formData?: FormData) {
  await clearAccountSession();
  const { clearCreatorSession } = await import("@/lib/claim");
  await clearCreatorSession().catch(() => undefined);
  const nextRaw = String(formData?.get("next") ?? "").trim();
  if (nextRaw) {
    const next = safeNextPath(nextRaw, "/");
    if (next.startsWith("/collaboration/contracts")) {
      redirect(`/login?next=${encodeURIComponent(next)}`);
    }
  }
  redirect("/");
}

export async function actionSaveEmailPreference(formData: FormData) {
  const session = await getAccountSession();
  if (!session) redirect("/login?next=/account/notifications");
  const { saveEmailPreference } = await import("@/lib/email-live");
  await saveEmailPreference({
    email: session.email,
    collaborations: formData.get("collaborations") === "on",
    billing: formData.get("billing") === "on",
    outreach: formData.get("outreach") === "on",
    productNews: formData.get("productNews") === "on",
  });
  redirect("/account/notifications?saved=1");
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
