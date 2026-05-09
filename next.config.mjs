/** @type {import('next').NextConfig} */
const nextConfig = {
  // Strict mode for catching potential issues early
  reactStrictMode: true,

  // Transpile sigma.js and graphology — they ship as ESM-only packages and
  // Next.js requires explicit transpilation for non-CJS node_modules.
  transpilePackages: [
    "sigma",
    "graphology",
    "graphology-layout",
    "graphology-layout-forceatlas2",
    "@react-sigma/core",
  ],

  // Rewrites to proxy API calls to the backend during development
  // In production, set MEATYWIKI_PORTAL_API_URL and handle via middleware
  async rewrites() {
    return process.env.NODE_ENV === 'development'
      ? [
          {
            source: '/api/:path*',
            destination: `${process.env.MEATYWIKI_PORTAL_API_URL ?? 'http://127.0.0.1:8787'}/api/:path*`,
          },
        ]
      : [];
  },
};

export default nextConfig;
