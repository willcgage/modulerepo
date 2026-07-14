import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  // The changelog markdown is read from disk at request time; make sure Vercel
  // bundles it into the routes that need it (bundler-agnostic — unlike a webpack
  // loader, this works whether the build uses webpack or Turbopack).
  outputFileTracingIncludes: {
    "/changelog": ["./src/content/CHANGELOG.md"],
    "/dashboard": ["./src/content/CHANGELOG.md"],
  },
};

export default nextConfig;
