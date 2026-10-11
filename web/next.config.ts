import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Keep the dev indicator away from the sidebar's account block.
  devIndicators: { position: 'bottom-right' },
  partialPrefetching: true,
  // The landing page is at "/" and the app under "/wallet" (ADR-040). The app's old paths keep working
  // (bookmarks, payment request links and QR codes made before): temporary redirects, query kept.
  redirects() {
    return [
      { source: '/start', destination: '/', permanent: false },
      // The legacy Key Safe recovery is gone (#33, ADR-042): one flow for a lost or stolen phone.
      { source: '/recover', destination: '/wallet/lost', permanent: false },
      { source: '/wallet/recover', destination: '/wallet/lost', permanent: false },
      ...['activity', 'earn', 'handle', 'offers', 'receive', 'security', 'send', 'swap', 'swissquote', 'welcome', 'lost'].map((page) => ({
        source: `/${page}/:rest*`,
        destination: `/wallet/${page}/:rest*`,
        permanent: false,
      })),
    ]
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
