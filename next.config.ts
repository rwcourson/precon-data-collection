import type { NextConfig } from "next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {
  // Notes accept any file type up to 25 MB; leave headroom for multipart wrappers.
  experimental: {
    serverActions: {
      bodySizeLimit: "26mb",
    },
  },
  // PGlite loads WASM assets from disk at runtime; keep it out of the bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
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
