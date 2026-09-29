import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for lean Docker image (copies .next/standalone)
  output: "standalone",
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
