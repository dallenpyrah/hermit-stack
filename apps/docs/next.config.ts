import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

const withMDX = createMDX();

const devRewrites = (): Promise<{ destination: string; source: string }[]> =>
  Promise.resolve([{ destination: "/md/:slug*", source: "/:slug*.md" }]);

const nextConfig = (phase: string): NextConfig => {
  const config: NextConfig = {
    devIndicators: false,
    images: { unoptimized: true },
    output: "export",
    reactStrictMode: true,
    trailingSlash: false,
  };

  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return withMDX({ ...config, rewrites: devRewrites });
  }

  return withMDX(config);
};

export default nextConfig;
