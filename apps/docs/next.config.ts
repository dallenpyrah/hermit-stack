import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();

// A static export runs on any of the clouds as plain files, with search running in the browser.
const nextConfig: NextConfig = {
  devIndicators: false,
  images: { unoptimized: true },
  output: "export",
  reactStrictMode: true,
};

export default withMDX(nextConfig);
