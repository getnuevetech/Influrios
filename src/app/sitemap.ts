import type { MetadataRoute } from "next";

const BASE = "https://influrios.com";
const PAGES = ["/", "/discover", "/categories", "/collaboration", "/business", "/pricing", "/faq", "/trust", "/card", "/legal", "/signup", "/login"];

/** Static public pages. Influencer profiles are added as the directory goes live. */
export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((path) => ({ url: `${BASE}${path}`, changeFrequency: "weekly", priority: path === "/" ? 1 : 0.6 }));
}
