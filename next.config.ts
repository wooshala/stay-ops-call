import type { NextConfig } from "next";

console.log("SUPABASE_SERVICE_ROLE_KEY exists:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

const nextConfig: NextConfig = {
  experimental: {
    // proxy.ts buffers request bodies for all /api/* routes.
    // Default is 10MB which truncates large audio uploads → multipart parse failure.
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
