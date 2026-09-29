import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for AWS Lightsail / PM2 deploys
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
