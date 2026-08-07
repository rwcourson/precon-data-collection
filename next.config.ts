import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite loads WASM assets from disk at runtime; keep it out of the bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
