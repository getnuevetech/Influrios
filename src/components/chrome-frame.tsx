"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { hidesMarketingChrome } from "@/lib/chrome-routes";

/** Plan pages and signed-in shells draw their own header. The URL decides, not a request header. */
export function ChromeFrame({
  header,
  footer,
  children,
}: {
  header: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  const path = usePathname() ?? "";
  const bare = hidesMarketingChrome(path);
  return (
    <>
      {bare ? null : header}
      <main>{children}</main>
      {bare ? null : footer}
    </>
  );
}
