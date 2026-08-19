import { withEve } from "eve/next";
import type { NextConfig } from "next";

// Inline scripts stay allowed: the root layout injects the theme script via
// dangerouslySetInnerHTML and Next.js emits its own inline bootstrap scripts.
// Dev needs 'unsafe-eval' for HMR/source maps; production does not get it.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Browsers ignore HSTS on insecure origins, so this is harmless in local dev.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  // Notes accept any file type up to 25 MB; leave headroom for multipart wrappers.
  experimental: {
    serverActions: {
      bodySizeLimit: "26mb",
    },
  },
  // PGlite loads WASM assets from disk at runtime; keep it out of the bundle.
  // Chromium (PDF export) ships a compressed binary that must stay on disk too.
  serverExternalPackages: [
    "@electric-sql/pglite",
    "@sparticuz/chromium",
    "playwright-core",
    "@better-auth/cimd",
    "@better-auth/mcp",
    "@better-auth/oauth-provider",
    "@modelcontextprotocol/server",
  ],
  // Local file: vendor package — ensure Next transpiles ESM chart-elements.
  transpilePackages: ["@rwcourson/chart-elements"],
  // Keep build tracing and Turbopack discovery inside this repository even
  // when a parent directory contains another package-manager lockfile.
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    "/api/export/pptx": ["./src/lib/brand/assets/**/*"],
  },
  turbopack: { root: process.cwd() },
  // The isolated browser harness uses the loopback address with an ephemeral port.
  allowedDevOrigins: ["127.0.0.1"],
};

// withEve() starts the local Eve sibling during `next dev` and would also
// rewrite the Vercel build to `eve build` (Node >=24). Production copilot
// falls back to Magnus; skip the wrapper on Vercel so `next build` stays.
export default process.env.VERCEL ? nextConfig : withEve(nextConfig);
