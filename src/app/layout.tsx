import type { Metadata } from "next";
import localFont from "next/font/local";
import { ChromeFrame } from "@/components/chrome-frame";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import "./globals.css";

// Shipped files, not next/font/google. The image build must not call
// fonts.googleapis.com: that fetch crashes next/font when the CSS URL has
// no font extension, and a Lightsail builder often cannot reach Google.
const plusJakarta = localFont({
  src: [
    { path: "../fonts/plus-jakarta-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/plus-jakarta-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/plus-jakarta-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/plus-jakarta-sans-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-plus-jakarta",
  display: "swap",
  adjustFontFallback: "Arial",
});

const sora = localFont({
  src: [
    { path: "../fonts/sora-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/sora-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-sora",
  display: "swap",
  adjustFontFallback: "Arial",
});

const caveat = localFont({
  src: [
    { path: "../fonts/caveat-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/caveat-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/caveat-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-caveat",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Influrios — Find the right influence",
    template: "%s · Influrios",
  },
  description:
    "Influence discovery and collaboration platform. Create your free Influencer Card. One card. All your influence.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${plusJakarta.variable} ${sora.variable} ${caveat.variable} antialiased`}>
        <ChromeFrame header={<SiteHeader />} footer={<SiteFooter />}>
          {children}
        </ChromeFrame>
      </body>
    </html>
  );
}
