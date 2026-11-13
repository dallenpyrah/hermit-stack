import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

const withMDX = createMDX();

// The export writes each page's Markdown twin to out/<slug>.md. The dev server has no such files, so it serves the
// Same route under the same address.
const devRewrites = (): Promise<{ destination: string; source: string }[]> =>
  Promise.resolve([{ destination: "/md/:slug*", source: "/:slug*.md" }]);

// A static export runs on any of the clouds as plain files, with search running in the browser.
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
