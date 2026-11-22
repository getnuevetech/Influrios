import type { NextConfig } from "next";

/** Set in the Dockerfile builder stage. CI still runs lint + tsc separately. */
const dockerBuild = process.env.DOCKER_BUILD === "1";

/**
 * Browser security headers (the live site sent none). CSP starts report-only so nothing
 * breaks while the allowed sources are confirmed; frame-ancestors is enforced by X-Frame-Options.
 */
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      "script-src 'self' 'unsafe-inline' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "connect-src 'self' https://api.stripe.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self' https:",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Do not advertise the framework (X-Powered-By: Next.js).
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Required for lean Docker image (copies .next/standalone)
  output: "standalone",
  // CI runs `npm run lint`. Skipping eslint here keeps the Lightsail image
  // build under the heap cap when Postgres is already using RAM.
  eslint: { ignoreDuringBuilds: dockerBuild },
  // CI / local `tsc` covers types. The Docker build only needs compile +
  // standalone output; typecheck alone OOMs at 768 MB on current main.
  typescript: { ignoreBuildErrors: dockerBuild },
  // Keep webpack memory low on small Lightsail instances.
  // webpackBuildWorker defaults to on when webpack is not customized, and
  // that child inherits NODE_OPTIONS, so two heaps run at once. Stay on one
  // process. cpus must stay set: the memory-based worker count floors at 4.
  experimental: {
    cpus: 1,
    webpackBuildWorker: false,
    webpackMemoryOptimizations: true,
    parallelServerBuildTraces: false,
    staticGenerationMaxConcurrency: 1,
    // Deliverable batch = 4 × 8 MB plus multipart overhead (COR-21). KYC and
    // other document uploads also need headroom above the 1 MB default.
    // middlewareClientMaxBodySize defaults to 10mb and truncates bodies before
    // serverActions.bodySizeLimit can apply (Next 15.5 + src/middleware.ts).
    middlewareClientMaxBodySize: "40mb",
    serverActions: {
      bodySizeLimit: "40mb",
      allowedOrigins: ["influrios.com", "www.influrios.com", "localhost:3000", "127.0.0.1:3000"],
    },
  },
  images: {
    // Creator and CMS media are served from this app. Remote optimization is off
    // so the image route cannot fetch arbitrary hosts.
    remotePatterns: [],
  },
  async redirects() {
    return [
      {
        source: "/api/social/callback/",
        destination: "/api/social/callback",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          // TikTok fetches https://influrios.com/tiktok<token>.txt
          source: "/:file(tiktok[A-Za-z0-9-]+\\.txt)",
          destination: "/myfiles/:file",
        },
      ],
    };
  },
  webpack: (config, { dev }) => {
    // The Docker builder has a 1024 MB heap and shares a small Lightsail box
    // with Postgres. An in-memory webpack cache pushes that build over the edge.
    if (!dev && dockerBuild) {
      config.cache = false;
      config.parallelism = 1;
    }
    return config;
  },
};

export default nextConfig;
