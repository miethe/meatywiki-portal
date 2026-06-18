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

  // Proxy /api/* to the FastAPI backend.
  //
  // The browser talks only to the Next origin (e.g. :3020); these rewrites are
  // applied server-side by the Next server (afterFiles), so the local
  // /api/auth/session route handler still takes precedence and everything else
  // is forwarded to the backend.
  //
  // - Development: defaults to the local uv-run backend port when
  //   MEATYWIKI_PORTAL_API_URL is unset.
  // - Production (e.g. the shared agentic node running `next start`): the proxy
  //   is enabled whenever MEATYWIKI_PORTAL_API_URL is set. Without this the
  //   browser would hit :PORT/api/* on the UI origin, which has no route
  //   handler → 404 (was previously the case: rewrites were dev-only).
  //
  // NOTE: rewrites are baked into routes-manifest.json at `next build`, so
  // MEATYWIKI_PORTAL_API_URL must be present at build time and a rebuild is
  // required for changes to take effect.
  async rewrites() {
    const backend =
      process.env.MEATYWIKI_PORTAL_API_URL ??
      (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8787' : null);
    if (!backend) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
