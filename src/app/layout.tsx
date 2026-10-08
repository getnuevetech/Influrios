import type { Metadata } from "next";
import { Caveat, Plus_Jakarta_Sans, Sora } from "next/font/google";
import { ChromeFrame } from "@/components/chrome-frame";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
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
