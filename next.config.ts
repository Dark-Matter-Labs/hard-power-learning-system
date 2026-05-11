import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: '12mb',
    },
    optimizePackageImports: ['@anthropic-ai/sdk', '@supabase/supabase-js'],
  },
};

export default nextConfig;
