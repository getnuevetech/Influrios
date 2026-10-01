import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for lean Docker image (copies .next/standalone)
  output: "standalone",
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
