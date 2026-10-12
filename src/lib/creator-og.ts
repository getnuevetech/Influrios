import type { Metadata } from "next";
import { specialtyLabel } from "@/lib/seed-data";

export type CreatorOgInput = {
  slug: string;
  displayName: string;
  title?: string | null;
  bio?: string | null;
  image?: string | null;
  specialties?: string[];
};

export function appOrigin(): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (raw && /^https?:\/\//i.test(raw) && !/YOUR_/i.test(raw)) return raw;
  return "https://influrios.com";
}

export function absoluteAssetUrl(pathOrUrl: string | null | undefined, origin = appOrigin()): string {
  const raw = (pathOrUrl || "").trim();
  if (!raw) return `${origin}/brand/avatars/generic.png`;
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${origin}${path}`;
}

export function specialtySummary(specialties: string[] | undefined, limit = 3): string {
  const labels = (specialties ?? [])
    .map((slug) => specialtyLabel(slug) || slug)
    .filter(Boolean)
    .slice(0, limit);
  return labels.join(" · ");
}

export function creatorOgDescription(creator: CreatorOgInput): string {
  const bio = creator.bio?.trim();
  if (bio) return bio.slice(0, 200);
  const specialty = specialtySummary(creator.specialties);
  const designation = creator.title?.trim();
  const bits = [
    `${creator.displayName} on Influrios`,
    designation || null,
    specialty || null,
  ].filter(Boolean);
  return bits.join(" · ");
}

/** Canonical profile URL — SEO ownership stays on Influrios, not INFLR.me. */
export function creatorCanonicalUrl(slug: string, origin = appOrigin()): string {
  return `${origin}/creators/${slug}`;
}

export function creatorCardUrl(slug: string, origin = appOrigin()): string {
  return `${origin}/c/${slug}`;
}

/**
 * Influrios-branded Open Graph / Twitter metadata for Influencer Card & profile
 * (INFLR.me Spec §11).
 */
export function creatorShareMetadata(
  creator: CreatorOgInput,
  opts: { surface: "card" | "profile" },
): Metadata {
  const origin = appOrigin();
  const canonical = creatorCanonicalUrl(creator.slug, origin);
  const card = creatorCardUrl(creator.slug, origin);
  const pageUrl = opts.surface === "card" ? card : canonical;
  const title =
    opts.surface === "card"
      ? `${creator.displayName} · Influencer Card`
      : `${creator.displayName} · Influencer`;
  const description = creatorOgDescription(creator);
  const image = absoluteAssetUrl(creator.image, origin);
  const specialty = specialtySummary(creator.specialties);

  return {
    title,
    description,
    keywords: [
      "influencer",
      "influencer card",
      "content creator",
      "creator",
      "Influrios",
      creator.displayName,
      creator.title || undefined,
      ...(creator.specialties ?? []),
    ].filter(Boolean) as string[],
    alternates: { canonical },
    openGraph: {
      type: "profile",
      siteName: "Influrios",
      title: specialty ? `${creator.displayName} · ${specialty}` : title,
      description,
      url: pageUrl,
      images: [
        {
          url: image,
          alt: `${creator.displayName} on Influrios`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: specialty ? `${creator.displayName} · ${specialty}` : title,
      description,
      images: [image],
    },
  };
}

export function isSocialPreviewBot(userAgent: string | null | undefined): boolean {
  const ua = (userAgent || "").toLowerCase();
  if (!ua) return false;
  return /(facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|pinterest|vkshare|embedly|quora link preview|outbrain|rogerbot|showyoubot|scoop\.it|redditbot|applebot|tumblr)/.test(
    ua,
  );
}

/** Lightweight interstitial for INFLR.me crawlers — branded preview, canonical on Influrios. */
export function socialPreviewInterstitialHtml(input: {
  creator: CreatorOgInput;
  destinationUrl: string;
}): string {
  const origin = appOrigin();
  const canonical = creatorCanonicalUrl(input.creator.slug, origin);
  const title = escapeHtml(`${input.creator.displayName} · Influrios`);
  const description = escapeHtml(creatorOgDescription(input.creator));
  const image = escapeHtml(absoluteAssetUrl(input.creator.image, origin));
  const dest = escapeHtml(input.destinationUrl);
  const canon = escapeHtml(canonical);
  const specialty = escapeHtml(specialtySummary(input.creator.specialties));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="canonical" href="${canon}" />
  <meta name="description" content="${description}" />
  <meta property="og:type" content="profile" />
  <meta property="og:site_name" content="Influrios" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${canon}" />
  <meta property="og:image" content="${image}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
  <meta http-equiv="refresh" content="0;url=${dest}" />
  <style>
    @font-face { font-family: "Plus Jakarta Sans"; src: url("/fonts/plus-jakarta-sans-latin-400-normal.woff2") format("woff2"); font-weight: 400; font-style: normal; font-display: swap; }
    @font-face { font-family: "Plus Jakarta Sans"; src: url("/fonts/plus-jakarta-sans-latin-700-normal.woff2") format("woff2"); font-weight: 700; font-style: normal; font-display: swap; }
    @font-face { font-family: Sora; src: url("/fonts/sora-latin-700-normal.woff2") format("woff2"); font-weight: 700; font-style: normal; font-display: swap; }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh; color: #fff;
      font-family: "Plus Jakarta Sans", "Segoe UI", sans-serif;
      background:
        radial-gradient(980px 560px at 8% 0%, rgba(92, 78, 230, 0.42), transparent 62%),
        radial-gradient(860px 640px at 82% 100%, rgba(62, 36, 190, 0.5), transparent 62%),
        linear-gradient(180deg, #16124f 0%, #0c1138 48%, #080b24 100%);
      display: grid; place-items: center; padding: 32px 20px;
    }
    main {
      width: min(28rem, 100%); padding: 36px 28px 28px; text-align: center; border-radius: 28px;
      background: linear-gradient(180deg, rgba(32, 28, 92, 0.72), rgba(14, 16, 58, 0.84));
      border: 1px solid rgba(186, 196, 255, 0.24);
      box-shadow: 0 30px 80px rgba(3, 6, 28, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.16);
    }
    .brand { margin: 0; letter-spacing: 0.42em; font-size: 13px; font-weight: 600; color: #eceaff; }
    h1 { margin: 18px 0 8px; font-family: Sora, "Plus Jakarta Sans", sans-serif; font-size: 2rem; letter-spacing: -0.03em; }
    .specialty, .bio { color: #d7e0fb; line-height: 1.45; }
    .specialty { margin: 0 0 10px; }
    .bio { margin: 0; }
    a.cta {
      display: inline-flex; margin-top: 22px; padding: 14px 24px; border-radius: 999px;
      background: linear-gradient(90deg, #7a3dff 0%, #3d7bff 100%);
      color: #fff; text-decoration: none; font-weight: 700;
    }
  </style>
</head>
<body>
  <main>
    <p class="brand">INFLURIOS</p>
    <h1>${escapeHtml(input.creator.displayName)}</h1>
    ${specialty ? `<p class="specialty">${specialty}</p>` : ""}
    <p class="bio">${description}</p>
    <a class="cta" href="${dest}">Continue to profile</a>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Extract creator slug from an Influrios card/profile destination. */
export function creatorSlugFromDestination(destinationUrl: string, origin = appOrigin()): string | null {
  const trimmed = destinationUrl.trim();
  const relative = trimmed.match(/^\/(?:c|creators)\/([a-z0-9][a-z0-9-]{1,60})$/i);
  if (relative) return relative[1].toLowerCase();
  try {
    const url = new URL(trimmed, origin);
    const originHost = new URL(origin).hostname.toLowerCase().replace(/^www\./, "");
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== originHost && host !== "influrios.com") return null;
    const match = url.pathname.match(/^\/(?:c|creators)\/([a-z0-9][a-z0-9-]{1,60})$/i);
    return match?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}
