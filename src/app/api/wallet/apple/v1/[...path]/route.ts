/**
 * Apple Wallet web service (PassKit): iPhones register for updates, ask which passes changed, and fetch the
 * latest pass. https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { applePassFor } from "@/lib/wallet";
import { applePassAuthToken } from "@/lib/wallet/card";
import { getAppleWalletConfig } from "@/lib/wallet/config";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

function authorized(request: Request, serial: string) {
  const header = request.headers.get("authorization") ?? "";
  return header === `ApplePass ${applePassAuthToken(serial)}`;
}

async function serialToSlug(serial: string) {
  const creator = await prisma.creator.findUnique({ where: { id: serial }, select: { slug: true, updatedAt: true } }).catch(() => null);
  return creator;
}

// POST devices/{device}/registrations/{passType}/{serial} — register for updates
// POST log — device error log
export async function POST(request: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  if (path[0] === "log") {
    const body = (await request.json().catch(() => ({}))) as { logs?: string[] };
    for (const line of (body.logs ?? []).slice(0, 20)) console.warn("apple wallet device log:", String(line).slice(0, 500));
    return new NextResponse(null, { status: 200 });
  }
  if (path[0] !== "devices" || path[2] !== "registrations" || path.length !== 5) return new NextResponse(null, { status: 404 });
  const [, deviceLibraryId, , passTypeIdentifier, serialNumber] = path;
  if (!authorized(request, serialNumber)) return new NextResponse(null, { status: 401 });
  const config = await getAppleWalletConfig();
  if (!config || config.passTypeIdentifier !== passTypeIdentifier) return new NextResponse(null, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { pushToken?: string };
  if (!body.pushToken) return new NextResponse(null, { status: 400 });
  const existing = await prisma.walletPassRegistration.findUnique({
    where: { deviceLibraryId_passTypeIdentifier_serialNumber: { deviceLibraryId, passTypeIdentifier, serialNumber } },
  });
  await prisma.walletPassRegistration.upsert({
    where: { deviceLibraryId_passTypeIdentifier_serialNumber: { deviceLibraryId, passTypeIdentifier, serialNumber } },
    create: { deviceLibraryId, passTypeIdentifier, serialNumber, pushToken: body.pushToken },
    update: { pushToken: body.pushToken },
  });
  return new NextResponse(null, { status: existing ? 200 : 201 });
}

// DELETE devices/{device}/registrations/{passType}/{serial} — the pass was removed from the phone
export async function DELETE(request: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  if (path[0] !== "devices" || path[2] !== "registrations" || path.length !== 5) return new NextResponse(null, { status: 404 });
  const [, deviceLibraryId, , passTypeIdentifier, serialNumber] = path;
  if (!authorized(request, serialNumber)) return new NextResponse(null, { status: 401 });
  await prisma.walletPassRegistration.deleteMany({ where: { deviceLibraryId, passTypeIdentifier, serialNumber } });
  return new NextResponse(null, { status: 200 });
}

// GET devices/{device}/registrations/{passType}?passesUpdatedSince=… — which of this phone's passes changed
// GET passes/{passType}/{serial} — the latest pass
export async function GET(request: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  if (path[0] === "passes" && path.length === 3) {
    const serial = path[2];
    if (!authorized(request, serial)) return new NextResponse(null, { status: 401 });
    const creator = await serialToSlug(serial);
    if (!creator) return new NextResponse(null, { status: 404 });
    const since = request.headers.get("if-modified-since");
    if (since && Math.floor(creator.updatedAt.getTime() / 1000) <= Math.floor(new Date(since).getTime() / 1000)) {
      return new NextResponse(null, { status: 304 });
    }
    const pass = await applePassFor(creator.slug);
    if (!pass.ok) return new NextResponse(null, { status: pass.status });
    return new NextResponse(new Uint8Array(pass.bytes), {
      headers: { "Content-Type": "application/vnd.apple.pkpass", "Last-Modified": creator.updatedAt.toUTCString() },
    });
  }
  if (path[0] === "devices" && path[2] === "registrations" && path.length === 4) {
    const [, deviceLibraryId, , passTypeIdentifier] = path;
    const registrations = await prisma.walletPassRegistration.findMany({
      where: { deviceLibraryId, passTypeIdentifier },
      select: { serialNumber: true },
    });
    if (registrations.length === 0) return new NextResponse(null, { status: 204 });
    const sinceRaw = new URL(request.url).searchParams.get("passesUpdatedSince");
    const since = sinceRaw && /^\d+$/.test(sinceRaw) ? new Date(Number(sinceRaw)) : null;
    const creators = await prisma.creator.findMany({
      where: { id: { in: registrations.map((row) => row.serialNumber) }, ...(since ? { updatedAt: { gt: since } } : {}) },
      select: { id: true, updatedAt: true },
    });
    if (creators.length === 0) return new NextResponse(null, { status: 204 });
    const lastUpdated = Math.max(...creators.map((row) => row.updatedAt.getTime()));
    return NextResponse.json({ serialNumbers: creators.map((row) => row.id), lastUpdated: String(lastUpdated) });
  }
  return new NextResponse(null, { status: 404 });
}
