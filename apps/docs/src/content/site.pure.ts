import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

const siteName = "hermitstack";

const siteMark = "🐚";

const siteTagline = "Same crab, new shell.";

const siteDescription =
  "A template monorepo to fork for new products: one Effect program, where the domain, the host and the cloud are each a Layer.";

const layoutOptions: BaseLayoutProps = {
  nav: { title: `${siteMark} ${siteName}` },
};

export { layoutOptions, siteDescription, siteMark, siteName, siteTagline };
