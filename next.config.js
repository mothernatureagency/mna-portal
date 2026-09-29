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

  // OAuth discovery lives at well-known URLs the spec fixes for us. The app
  // router won't serve a route folder whose name starts with a dot, so the
  // documents are ordinary API routes and these rewrites put them where
  // clients look. RFC 9728 appends the resource's path to the metadata URL,
  // hence the :path* variants.
  async rewrites() {
    return [
      { source: '/.well-known/oauth-protected-resource', destination: '/api/oauth/protected-resource' },
      { source: '/.well-known/oauth-protected-resource/:path*', destination: '/api/oauth/protected-resource' },
      { source: '/.well-known/oauth-authorization-server', destination: '/api/oauth/authorization-server' },
      { source: '/.well-known/oauth-authorization-server/:path*', destination: '/api/oauth/authorization-server' },
      // Some clients look for the OpenID document instead; the payload is the
      // same and answering costs nothing.
      { source: '/.well-known/openid-configuration', destination: '/api/oauth/authorization-server' },
    ];
  },
};
module.exports = nextConfig;
