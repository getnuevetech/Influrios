import type { NextConfig } from "next";

/** Set in the Dockerfile builder stage. CI still runs lint + tsc separately. */
const dockerBuild = process.env.DOCKER_BUILD === "1";

const nextConfig: NextConfig = {
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
