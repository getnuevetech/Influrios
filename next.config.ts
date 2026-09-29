import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Regular Next build + `next start` via PM2 (simpler on Lightsail than standalone)
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
