import { NextRequest } from "next/server";
import { GET as resolveShortLink } from "../route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** inflr.me/{handle} is rewritten here so the handle is a path segment, not a dropped query param. */
export function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return resolveShortLink(request, context);
}
