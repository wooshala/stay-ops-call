import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // proxy.ts buffers request bodies for all /api/* routes.
    // Default is 10MB which truncates large audio uploads → multipart parse failure.
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
