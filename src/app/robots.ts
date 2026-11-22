import type { MetadataRoute } from "next";

/** Public pages are indexable; accounts, admin, claim drafts and APIs are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/account", "/claim/", "/business/", "/creator", "/dashboard", "/collaboration/", "/payments", "/billing", "/myfiles", "/notifications"],
      },
    ],
    sitemap: "https://influrios.com/sitemap.xml",
    host: "https://influrios.com",
  };
}
