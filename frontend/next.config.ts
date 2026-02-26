import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production: standalone output for Docker deployment
  output: "standalone",

  // Allow API proxy in development
  async rewrites() {
    return [];
  },
};

export default nextConfig;
