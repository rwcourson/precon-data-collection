import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite loads WASM assets from disk at runtime; keep it out of the bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Local file: vendor package — ensure Next transpiles ESM chart-elements.
  transpilePackages: ["@rwcourson/chart-elements"],
  // Keep build tracing and Turbopack discovery inside this repository even
  // when a parent directory contains another package-manager lockfile.
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
  // The isolated browser harness uses the loopback address with an ephemeral port.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
