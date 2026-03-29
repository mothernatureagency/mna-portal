/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allow SVG files via next/image (set dangerouslyAllowSVG for inline use;
    // here we intentionally handle SVGs with plain <img> tags instead)
    formats: ['image/avif', 'image/webp'],

    // No external domains needed — all logos served from /public
    remotePatterns: [],

    // Output quality for retina optimization
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};
module.exports = nextConfig;
