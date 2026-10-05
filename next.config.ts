import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["node:sqlite"],
  outputFileTracingIncludes: {
    "/api/**/*": ["./src/data/cards.db"],
  },
};

export default nextConfig;
