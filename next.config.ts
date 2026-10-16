import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // optimized images are kept for 30 days; uploaded files get new names when they change
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      new URL("https://images.taqwabazaar.com/**"), // uploaded images (Hostinger subdomain, hosting/images/_upload)
      new URL("https://cdn.dummyjson.com/product-images/**"), // demo product photos
    ],
  },
  experimental: {
    serverActions: {
      // admin uploads one image per request; images are capped at 5MB in src/lib/uploads.ts
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
