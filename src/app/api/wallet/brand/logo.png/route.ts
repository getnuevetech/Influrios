import { brandMarkSvg, pngFromSvg } from "@/lib/wallet/card";

/** Square Influrios mark used as the Google Wallet pass logo. */
export async function GET() {
  const png = await pngFromSvg(brandMarkSvg(660), 660);
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
}
