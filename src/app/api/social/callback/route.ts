import { NextRequest, NextResponse } from "next/server";
import { oauthAppOrigin } from "@/lib/billing";
import { completeSocialCallback } from "@/lib/social-connect";

function publicOrigin(request: NextRequest) {
  return oauthAppOrigin({
    proto: request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", ""),
    host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
  });
}

/** Instagram sometimes appends `#_` to the redirect; strip it from the code param. */
function cleanOAuthCode(code: string | null) {
  if (!code) return undefined;
  return code.replace(/#_*$/, "").trim() || undefined;
}

function friendlyProviderError(error: string | undefined, description: string | undefined) {
  const blob = `${error ?? ""} ${description ?? ""}`.toLowerCase();
  if (blob.includes("invalid platform app")) {
    return "Instagram rejected this app id (Invalid platform app). In Admin → Social → Instagram, use the Instagram App ID — or for newer Meta apps, paste a Unified Login Configuration ID with the Meta App ID.";
  }
  if (blob.includes("invalid scopes")) {
    return "Meta rejected the requested permissions (Invalid Scopes). For Facebook/Instagram on Login for Business apps, paste a Configuration ID in Admin → Social instead of freeform scopes.";
  }
  if (blob.includes("invalid_request")) {
    return "TikTok rejected the login request before it started. Nothing was retried. Use Retry on Social accounts.";
  }
  if (description?.trim()) return description.trim().slice(0, 300);
  if (error?.trim()) return error.trim().slice(0, 300);
  return undefined;
}

export async function GET(request: NextRequest) {
  const code = cleanOAuthCode(request.nextUrl.searchParams.get("code"));
  const state = request.nextUrl.searchParams.get("state") ?? undefined;
  const providerError = request.nextUrl.searchParams.get("error") ?? undefined;
  const providerDescription =
    request.nextUrl.searchParams.get("error_description") ??
    request.nextUrl.searchParams.get("error_message") ??
    undefined;
  const origin = publicOrigin(request);
  try {
    const mapped = friendlyProviderError(providerError, providerDescription);
    const result = await completeSocialCallback({
      code,
      state,
      error: mapped || providerError,
      origin,
    });
    const target = new URL("/dashboard/social", origin);
    if (result.ok) {
      target.searchParams.set("social", result.metricsSynced ? "synced" : "connected");
    } else {
      target.searchParams.set("error", result.error);
    }
    return NextResponse.redirect(target);
  } catch {
    const target = new URL("/dashboard/social", origin);
    target.searchParams.set("error", "The network could not be reached. The profile figures were not changed.");
    return NextResponse.redirect(target);
  }
}
