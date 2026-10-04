"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  href: string;
  pillarKey: string;
  title: string;
  className?: string;
  children: ReactNode;
};

/** Fires a privacy-light pillar click event, then navigates. */
export function ValuePropPillarLink({ href, pillarKey, title, className, children }: Props) {
  return (
    <Link
      href={href}
      className={className}
      data-analytics="homepage_value_prop_pillar"
      data-pillar-key={pillarKey}
      onClick={() => {
        const body = JSON.stringify({ pillarKey, linkUrl: href, title });
        try {
          if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
            const blob = new Blob([body], { type: "application/json" });
            navigator.sendBeacon("/api/analytics/value-prop", blob);
            return;
          }
        } catch {
          /* fall through to fetch */
        }
        void fetch("/api/analytics/value-prop", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => undefined);
      }}
    >
      {children}
    </Link>
  );
}
