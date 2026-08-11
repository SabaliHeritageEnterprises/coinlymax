/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Allow TradingView's external embed script + crypto logo CDNs.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.coingecko.com' },
      { protocol: 'https', hostname: 'assets.coincap.io' },
    ],
  },
};

export default nextConfig;
