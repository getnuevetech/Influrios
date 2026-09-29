import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for lean Docker image (copies .next/standalone)
  output: "standalone",
  // Keep webpack memory low on small Lightsail instances
  experimental: {
    cpus: 1,
    webpackMemoryOptimizations: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
